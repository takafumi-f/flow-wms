import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError, paginate } from '@/lib/api-helpers';
import { InventoryQuerySchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = InventoryQuerySchema.safeParse(params);
  if (!query.success) return apiError('Invalid query parameters', 400, query.error.flatten());

  const { page, limit, itemCode, locationCode, lowStockOnly } = query.data;
  const offset = (page - 1) * limit;

  // 商品別在庫サマリ
  const rows = await sql`
    SELECT
      i.id AS item_id,
      i.code AS item_code,
      i.name AS item_name,
      i.unit,
      i.reorder_point,
      SUM(inv.quantity) AS total_qty,
      SUM(inv.reserved_qty) AS reserved_qty,
      SUM(inv.quantity - inv.reserved_qty) AS available_qty,
      COUNT(DISTINCT inv.location_id) AS location_count,
      COUNT(*) OVER() AS total_count
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    JOIN locations l ON l.id = inv.location_id
    WHERE inv.warehouse_id = ${user.warehouseId!}
      AND i.tenant_id = ${user.tenantId}
      ${itemCode ? sql`AND i.code ILIKE ${'%' + itemCode + '%'}` : sql``}
      ${locationCode ? sql`AND l.code ILIKE ${'%' + locationCode + '%'}` : sql``}
    GROUP BY i.id, i.code, i.name, i.unit, i.reorder_point
    HAVING ${lowStockOnly}
      = false OR (i.reorder_point IS NOT NULL AND SUM(inv.quantity) <= i.reorder_point)
    ORDER BY i.code
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count: _, ...r }) => ({
    ...r,
    totalQty: Number(r.total_qty),
    reservedQty: Number(r.reserved_qty),
    availableQty: Number(r.available_qty),
    locationCount: Number(r.location_count),
    isLowStock: r.reorder_point !== null && Number(r.total_qty) <= Number(r.reorder_point),
  }));

  return paginate(data, total, page, limit);
}
