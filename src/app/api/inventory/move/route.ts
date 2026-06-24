import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import { InventoryMoveSchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = InventoryMoveSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  const { inventoryId, fromLocationId, toLocationId, quantity, note } = parsed.data;

  if (fromLocationId === toLocationId) {
    return apiError('Source and destination locations must differ', 400);
  }

  try {
    await sql.begin(async (tx) => {
      // ソース在庫を取得（楽観的ロック）
      const [src] = await tx`
        SELECT id, item_id, lot_number, serial_number, quantity, reserved_qty, version
        FROM inventory
        WHERE id = ${inventoryId}
          AND warehouse_id = ${user.warehouseId!}
          AND location_id = ${fromLocationId}
        FOR UPDATE
      `;

      if (!src) throw new Error('NOT_FOUND');
      if (Number(src.quantity) - Number(src.reserved_qty) < quantity) {
        throw new Error('INSUFFICIENT');
      }

      // ソース在庫を減少（楽観的ロック確認）
      const [srcUpdated] = await tx`
        UPDATE inventory
        SET quantity = quantity - ${quantity},
            version = version + 1
        WHERE id = ${src.id}
          AND version = ${src.version}
        RETURNING id
      `;
      if (!srcUpdated) throw new Error('LOCK_CONFLICT');

      // 数量が0になった場合は削除
      await tx`
        DELETE FROM inventory
        WHERE id = ${src.id} AND quantity = 0
      `;

      // 移動先に在庫を追加
      const [existing] = await tx`
        SELECT id, quantity, version FROM inventory
        WHERE warehouse_id = ${user.warehouseId!}
          AND location_id = ${toLocationId}
          AND item_id = ${src.item_id}
          AND COALESCE(lot_number, '') = COALESCE(${src.lot_number}, '')
        FOR UPDATE
      `;

      if (existing) {
        await tx`
          UPDATE inventory
          SET quantity = quantity + ${quantity},
              version = version + 1
          WHERE id = ${existing.id}
        `;
      } else {
        await tx`
          INSERT INTO inventory (
            warehouse_id, location_id, item_id,
            lot_number, serial_number, quantity, reserved_qty
          ) VALUES (
            ${user.warehouseId!}, ${toLocationId}, ${src.item_id},
            ${src.lot_number}, ${src.serial_number}, ${quantity}, 0
          )
        `;
      }

      // 在庫履歴（出）
      await tx`
        INSERT INTO inventory_transactions (
          warehouse_id, item_id, location_id, transaction_type,
          quantity, lot_number, reference_type, user_id, note
        ) VALUES (
          ${user.warehouseId!}, ${src.item_id}, ${fromLocationId},
          'move', ${-quantity}, ${src.lot_number},
          'move', ${user.id}, ${note ?? null}
        )
      `;

      // 在庫履歴（入）
      await tx`
        INSERT INTO inventory_transactions (
          warehouse_id, item_id, location_id, transaction_type,
          quantity, lot_number, reference_type, user_id, note
        ) VALUES (
          ${user.warehouseId!}, ${src.item_id}, ${toLocationId},
          'move', ${quantity}, ${src.lot_number},
          'move', ${user.id}, ${note ?? null}
        )
      `;
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'NOT_FOUND') return apiError('Inventory not found', 404);
    if (msg === 'INSUFFICIENT') return apiError('Insufficient available inventory', 422);
    if (msg === 'LOCK_CONFLICT') return apiError('Inventory was modified concurrently, please retry', 409);
    console.error('[POST /api/inventory/move]', err);
    return apiError('Internal server error');
  }
}
