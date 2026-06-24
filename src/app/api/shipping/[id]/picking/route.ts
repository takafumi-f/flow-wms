import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import { PickingSchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const { id: orderId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PickingSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  const { lineId, pickedQty, locationId, lotNumber } = parsed.data;

  try {
    const result = await sql.begin(async (tx) => {
      // 出荷明細を取得
      const [line] = await tx`
        SELECT sol.*, so.warehouse_id, so.status AS order_status
        FROM shipping_order_lines sol
        JOIN shipping_orders so ON so.id = sol.shipping_order_id
        WHERE sol.id = ${lineId}
          AND sol.shipping_order_id = ${orderId}
          AND so.warehouse_id = ${user.warehouseId!}
        FOR UPDATE
      `;

      if (!line) throw new Error('NOT_FOUND');
      if (['shipped', 'cancelled'].includes(line.order_status)) {
        throw new Error('ORDER_CLOSED');
      }

      const newPickedQty = Number(line.picked_qty) + pickedQty;
      if (newPickedQty > Number(line.ordered_qty)) {
        throw new Error('QTY_EXCEEDED');
      }

      // 在庫を引き当て（楽観的ロック）
      const [inv] = await tx`
        SELECT id, quantity, reserved_qty, version
        FROM inventory
        WHERE warehouse_id = ${user.warehouseId!}
          AND location_id = ${locationId}
          AND item_id = ${line.item_id}
          AND COALESCE(lot_number, '') = COALESCE(${lotNumber ?? null}, '')
        FOR UPDATE
      `;

      if (!inv) throw new Error('INVENTORY_NOT_FOUND');
      if (Number(inv.quantity) - Number(inv.reserved_qty) < pickedQty) {
        throw new Error('INSUFFICIENT_INVENTORY');
      }

      // 在庫を減らす
      const [updated] = await tx`
        UPDATE inventory
        SET quantity = quantity - ${pickedQty},
            version = version + 1
        WHERE id = ${inv.id}
          AND version = ${inv.version}
        RETURNING id
      `;
      if (!updated) throw new Error('OPTIMISTIC_LOCK_CONFLICT');

      // 出荷明細を更新
      const lineStatus = newPickedQty >= Number(line.ordered_qty) ? 'completed' : 'picking';
      await tx`
        UPDATE shipping_order_lines
        SET picked_qty = ${newPickedQty},
            location_id = ${locationId},
            lot_number = COALESCE(${lotNumber ?? null}, lot_number),
            status = ${lineStatus}
        WHERE id = ${lineId}
      `;

      // 在庫履歴
      await tx`
        INSERT INTO inventory_transactions (
          warehouse_id, item_id, location_id, transaction_type,
          quantity, lot_number, reference_type, reference_id, user_id
        ) VALUES (
          ${user.warehouseId!}, ${line.item_id}, ${locationId},
          'ship', ${-pickedQty}, ${lotNumber ?? null},
          'shipping_order', ${orderId}, ${user.id}
        )
      `;

      // オーダーのステータスを更新
      const pendingLines = await tx`
        SELECT COUNT(*) AS cnt
        FROM shipping_order_lines
        WHERE shipping_order_id = ${orderId}
          AND status != 'completed'
      `;

      if (Number(pendingLines[0].cnt) === 0) {
        await tx`
          UPDATE shipping_orders
          SET status = 'packed'
          WHERE id = ${orderId}
        `;
      } else {
        await tx`
          UPDATE shipping_orders
          SET status = 'picking'
          WHERE id = ${orderId} AND status = 'pending'
        `;
      }

      return { success: true, pickedQty: newPickedQty };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') return apiError('Line not found', 404);
    if (msg === 'ORDER_CLOSED') return apiError('Order is already closed', 409);
    if (msg === 'QTY_EXCEEDED') return apiError('Picked quantity exceeds ordered quantity', 422);
    if (msg === 'INVENTORY_NOT_FOUND') return apiError('Inventory not found at location', 404);
    if (msg === 'INSUFFICIENT_INVENTORY') return apiError('Insufficient inventory', 422);
    if (msg === 'OPTIMISTIC_LOCK_CONFLICT') return apiError('Inventory was modified concurrently, please retry', 409);
    console.error('[POST /api/shipping/:id/picking]', err);
    return apiError('Internal server error');
  }
}
