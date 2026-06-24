import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import { InspectSchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const { id: orderId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = InspectSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  const { lineId, scannedQty, locationId, lotNumber } = parsed.data;

  try {
    const result = await sql.begin(async (tx) => {
      // 入荷明細を取得
      const [line] = await tx`
        SELECT rol.*, ro.warehouse_id, ro.status AS order_status
        FROM receiving_order_lines rol
        JOIN receiving_orders ro ON ro.id = rol.receiving_order_id
        WHERE rol.id = ${lineId}
          AND rol.receiving_order_id = ${orderId}
          AND ro.warehouse_id = ${user.warehouseId!}
        FOR UPDATE
      `;

      if (!line) throw new Error('NOT_FOUND');
      if (line.order_status === 'completed' || line.order_status === 'cancelled') {
        throw new Error('ORDER_CLOSED');
      }

      const newReceivedQty = Number(line.received_qty) + scannedQty;
      if (newReceivedQty > Number(line.ordered_qty)) {
        throw new Error('QTY_EXCEEDED');
      }

      // 明細を更新
      await tx`
        UPDATE receiving_order_lines
        SET received_qty = ${newReceivedQty},
            location_id = ${locationId},
            lot_number = COALESCE(${lotNumber ?? null}, lot_number)
        WHERE id = ${lineId}
      `;

      // 在庫を追加（既存ロットに積み上げ or 新規作成）
      const [existingInv] = await tx`
        SELECT id, quantity, version FROM inventory
        WHERE warehouse_id = ${user.warehouseId!}
          AND location_id = ${locationId}
          AND item_id = ${line.item_id}
          AND COALESCE(lot_number, '') = COALESCE(${lotNumber ?? null}, '')
        FOR UPDATE
      `;

      if (existingInv) {
        await tx`
          UPDATE inventory
          SET quantity = quantity + ${scannedQty},
              version = version + 1
          WHERE id = ${existingInv.id}
            AND version = ${existingInv.version}
        `;
      } else {
        await tx`
          INSERT INTO inventory (
            warehouse_id, location_id, item_id,
            lot_number, quantity, reserved_qty
          ) VALUES (
            ${user.warehouseId!}, ${locationId}, ${line.item_id},
            ${lotNumber ?? null}, ${scannedQty}, 0
          )
        `;
      }

      // 在庫履歴を記録
      await tx`
        INSERT INTO inventory_transactions (
          warehouse_id, item_id, location_id, transaction_type,
          quantity, lot_number, reference_type, reference_id, user_id
        ) VALUES (
          ${user.warehouseId!}, ${line.item_id}, ${locationId},
          'receive', ${scannedQty}, ${lotNumber ?? null},
          'receiving_order', ${orderId}, ${user.id}
        )
      `;

      // オーダーのステータスを更新（全明細完了なら completed に）
      const remainingLines = await tx`
        SELECT COUNT(*) AS cnt
        FROM receiving_order_lines
        WHERE receiving_order_id = ${orderId}
          AND received_qty < ordered_qty
      `;

      if (Number(remainingLines[0].cnt) === 0) {
        await tx`
          UPDATE receiving_orders
          SET status = 'completed', received_at = NOW()
          WHERE id = ${orderId}
        `;
      } else {
        await tx`
          UPDATE receiving_orders
          SET status = 'in_progress'
          WHERE id = ${orderId} AND status = 'pending'
        `;
      }

      return { success: true, receivedQty: newReceivedQty };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') return apiError('Line not found', 404);
    if (msg === 'ORDER_CLOSED') return apiError('Order is already closed', 409);
    if (msg === 'QTY_EXCEEDED') return apiError('Received quantity exceeds ordered quantity', 422);
    console.error('[POST /api/receiving/:id/inspect]', err);
    return apiError('Internal server error');
  }
}
