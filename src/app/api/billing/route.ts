import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';
import { calcMonthlyBilling, daysInMonth } from '@/lib/utils/billing';

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;
  if (!user.warehouseId) return apiError('No warehouse assigned', 403);

  const now = new Date();
  const year = Number(req.nextUrl.searchParams.get('year') ?? now.getFullYear());
  const month = Number(req.nextUrl.searchParams.get('month') ?? now.getMonth() + 1);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return apiError('Invalid year or month', 400);
  }

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`;

  const [inboundResult, outboundResult, locationResult] = await Promise.all([
    sql`
      SELECT COUNT(*) AS cnt FROM receiving_order_lines rol
      JOIN receiving_orders ro ON ro.id = rol.receiving_order_id
      WHERE ro.warehouse_id = ${user.warehouseId}
        AND ro.status = 'completed'
        AND ro.received_at::date BETWEEN ${monthStart} AND ${monthEnd}
    `,
    sql`
      SELECT COUNT(*) AS cnt FROM shipping_order_lines sol
      JOIN shipping_orders so ON so.id = sol.shipping_order_id
      WHERE so.warehouse_id = ${user.warehouseId}
        AND so.status = 'shipped'
        AND so.shipped_at::date BETWEEN ${monthStart} AND ${monthEnd}
    `,
    sql`
      SELECT COUNT(DISTINCT location_id) AS cnt
      FROM inventory
      WHERE warehouse_id = ${user.warehouseId} AND quantity > 0
    `,
  ]);

  const days = daysInMonth(year, month);
  const billing = calcMonthlyBilling({
    storageDays: days,
    locationCount: Number(locationResult[0]?.cnt ?? 0),
    storageFeePerLocationPerDay: 10,
    inboundLines: Number(inboundResult[0]?.cnt ?? 0),
    outboundLines: Number(outboundResult[0]?.cnt ?? 0),
    inboundFeePerLine: 50,
    outboundFeePerLine: 80,
  });

  return NextResponse.json({ year, month, days, ...billing });
}
