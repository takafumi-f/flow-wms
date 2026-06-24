import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;
  if (!user.warehouseId) return apiError('No warehouse assigned', 403);

  const itemId = req.nextUrl.searchParams.get('itemId');

  const rows = await sql`
    SELECT
      inv.id,
      inv.lot_number,
      inv.serial_number,
      inv.expiry_date,
      inv.quantity,
      inv.reserved_qty,
      inv.quantity - inv.reserved_qty AS available_qty,
      inv.received_at,
      l.code AS location_code,
      i.code AS item_code,
      i.name AS item_name,
      i.unit
    FROM inventory inv
    JOIN locations l ON l.id = inv.location_id
    JOIN items i ON i.id = inv.item_id
    WHERE inv.warehouse_id = ${user.warehouseId}
      AND (inv.lot_number IS NOT NULL OR inv.serial_number IS NOT NULL)
      ${itemId ? sql`AND inv.item_id = ${itemId}` : sql``}
    ORDER BY inv.expiry_date ASC NULLS LAST, inv.received_at ASC
    LIMIT 200
  `;

  return NextResponse.json(rows);
}
