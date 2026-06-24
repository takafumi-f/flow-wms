import { NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';
import { detectStockDiscrepancy, detectExpiryAlert } from '@/lib/utils/alert';

export async function GET() {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;
  if (!user.warehouseId) return apiError('No warehouse assigned', 403);

  const [stocktakeDiffs, expiryRows] = await Promise.all([
    sql`
      SELECT
        i.name AS item_name,
        i.code AS item_code,
        sl.system_qty,
        sl.counted_qty,
        sl.difference
      FROM stocktake_lines sl
      JOIN stocktakes st ON st.id = sl.stocktake_id
      JOIN items i ON i.id = sl.item_id
      WHERE st.warehouse_id = ${user.warehouseId}
        AND st.status = 'completed'
        AND sl.counted_qty IS NOT NULL
        AND sl.difference != 0
      ORDER BY ABS(sl.difference) DESC
      LIMIT 50
    `,
    sql`
      SELECT
        i.name AS item_name,
        i.code AS item_code,
        inv.lot_number,
        inv.expiry_date,
        SUM(inv.quantity) AS qty
      FROM inventory inv
      JOIN items i ON i.id = inv.item_id
      WHERE inv.warehouse_id = ${user.warehouseId}
        AND inv.expiry_date IS NOT NULL
        AND inv.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND inv.quantity > 0
      GROUP BY i.name, i.code, inv.lot_number, inv.expiry_date
      ORDER BY inv.expiry_date ASC
      LIMIT 50
    `,
  ]);

  const alerts = [
    ...stocktakeDiffs.flatMap((row) => {
      const alert = detectStockDiscrepancy(
        Number(row.system_qty),
        Number(row.counted_qty),
      );
      return alert
        ? [{ ...alert, itemCode: row.item_code, itemName: row.item_name }]
        : [];
    }),
    ...expiryRows.flatMap((row) => {
      const days = Math.ceil(
        (new Date(row.expiry_date as string).getTime() - Date.now()) / 86_400_000,
      );
      const alert = detectExpiryAlert(
        `${row.item_name as string}${row.lot_number ? ` [${row.lot_number}]` : ''}`,
        days,
      );
      return alert
        ? [{ ...alert, itemCode: row.item_code, qty: Number(row.qty) }]
        : [];
    }),
  ];

  return NextResponse.json(alerts);
}
