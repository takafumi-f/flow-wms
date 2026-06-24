import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';

export async function GET(_req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  if (!user.warehouseId) return apiError('No warehouse assigned', 403);

  const warehouseId = user.warehouseId;
  const tenantId = user.tenantId;

  // 並列でKPIデータを取得
  const [
    todayReceiving,
    todayShipping,
    pendingReceiving,
    pendingShipping,
    lowStockItems,
    totalSkus,
    shippingLast7Days,
    recentShippingOrders,
    lowStockAlerts,
  ] = await Promise.all([
    // 今日の入荷完了件数
    sql`
      SELECT COUNT(*) AS cnt FROM receiving_orders
      WHERE warehouse_id = ${warehouseId}
        AND status = 'completed'
        AND received_at::date = CURRENT_DATE
    `,
    // 今日の出荷件数
    sql`
      SELECT COUNT(*) AS cnt FROM shipping_orders
      WHERE warehouse_id = ${warehouseId}
        AND status = 'shipped'
        AND shipped_at::date = CURRENT_DATE
    `,
    // 入荷待ち件数
    sql`
      SELECT COUNT(*) AS cnt FROM receiving_orders
      WHERE warehouse_id = ${warehouseId}
        AND status IN ('pending', 'in_progress')
    `,
    // 出荷待ち件数
    sql`
      SELECT COUNT(*) AS cnt FROM shipping_orders
      WHERE warehouse_id = ${warehouseId}
        AND status IN ('pending', 'picking', 'packed')
    `,
    // 在庫切れ・低在庫商品数
    sql`
      SELECT COUNT(DISTINCT i.id) AS cnt
      FROM items i
      JOIN inventory inv ON inv.item_id = i.id AND inv.warehouse_id = ${warehouseId}
      WHERE i.tenant_id = ${tenantId}
        AND i.reorder_point IS NOT NULL
      GROUP BY i.id, i.reorder_point
      HAVING SUM(inv.quantity) <= i.reorder_point
    `,
    // 総SKU数
    sql`
      SELECT COUNT(DISTINCT item_id) AS cnt
      FROM inventory
      WHERE warehouse_id = ${warehouseId}
    `,
    // 直近7日の日別出荷件数
    sql`
      SELECT
        to_char(d.date, 'YYYY-MM-DD') AS date,
        COUNT(so.id) AS count
      FROM generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) AS d(date)
      LEFT JOIN shipping_orders so ON
        so.shipped_at::date = d.date
        AND so.warehouse_id = ${warehouseId}
        AND so.status = 'shipped'
      GROUP BY d.date
      ORDER BY d.date
    `,
    // 直近の出荷指示5件
    sql`
      SELECT so.id, so.order_number, so.status, so.priority,
             so.required_date, p.name AS customer_name, so.created_at
      FROM shipping_orders so
      LEFT JOIN partners p ON p.id = so.customer_id
      WHERE so.warehouse_id = ${warehouseId}
      ORDER BY so.created_at DESC
      LIMIT 5
    `,
    // 低在庫アラート（上位10件）
    sql`
      SELECT
        i.id AS item_id,
        i.code AS item_code,
        i.name AS item_name,
        i.unit,
        i.reorder_point,
        SUM(inv.quantity) AS total_qty,
        SUM(inv.quantity - inv.reserved_qty) AS available_qty
      FROM items i
      JOIN inventory inv ON inv.item_id = i.id AND inv.warehouse_id = ${warehouseId}
      WHERE i.tenant_id = ${tenantId}
        AND i.reorder_point IS NOT NULL
      GROUP BY i.id, i.code, i.name, i.unit, i.reorder_point
      HAVING SUM(inv.quantity) <= i.reorder_point
      ORDER BY (SUM(inv.quantity)::float / NULLIF(i.reorder_point, 0)) ASC
      LIMIT 10
    `,
  ]);

  return NextResponse.json({
    todayReceiving: Number(todayReceiving[0]?.cnt ?? 0),
    todayShipping: Number(todayShipping[0]?.cnt ?? 0),
    pendingReceiving: Number(pendingReceiving[0]?.cnt ?? 0),
    pendingShipping: Number(pendingShipping[0]?.cnt ?? 0),
    lowStockItems: lowStockItems.length,
    totalSkus: Number(totalSkus[0]?.cnt ?? 0),
    shippingLast7Days: shippingLast7Days.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    recentShippingOrders,
    lowStockAlerts: lowStockAlerts.map((r) => ({
      ...r,
      totalQty: Number(r.total_qty),
      availableQty: Number(r.available_qty),
      isLowStock: true,
    })),
  });
}
