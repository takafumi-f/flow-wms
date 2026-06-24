import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShippingStatusBadge } from '@/components/ui/badge';
import type { KpiData } from '@/types';

async function getKpiData(warehouseId: string): Promise<KpiData | null> {
  try {
    // Server Componentでの直接DBアクセス
    const { default: sql } = await import('@/lib/db');

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
      sql`SELECT COUNT(*) AS cnt FROM receiving_orders WHERE warehouse_id = ${warehouseId} AND status = 'completed' AND received_at::date = CURRENT_DATE`,
      sql`SELECT COUNT(*) AS cnt FROM shipping_orders WHERE warehouse_id = ${warehouseId} AND status = 'shipped' AND shipped_at::date = CURRENT_DATE`,
      sql`SELECT COUNT(*) AS cnt FROM receiving_orders WHERE warehouse_id = ${warehouseId} AND status IN ('pending','in_progress')`,
      sql`SELECT COUNT(*) AS cnt FROM shipping_orders WHERE warehouse_id = ${warehouseId} AND status IN ('pending','picking','packed')`,
      sql`SELECT COUNT(DISTINCT i.id) AS cnt FROM items i JOIN inventory inv ON inv.item_id = i.id AND inv.warehouse_id = ${warehouseId} WHERE i.reorder_point IS NOT NULL GROUP BY i.id, i.reorder_point HAVING SUM(inv.quantity) <= i.reorder_point`,
      sql`SELECT COUNT(DISTINCT item_id) AS cnt FROM inventory WHERE warehouse_id = ${warehouseId}`,
      sql`
        SELECT to_char(d.date,'YYYY-MM-DD') AS date, COUNT(so.id) AS count
        FROM generate_series(CURRENT_DATE-INTERVAL'6 days',CURRENT_DATE,INTERVAL'1 day') AS d(date)
        LEFT JOIN shipping_orders so ON so.shipped_at::date=d.date AND so.warehouse_id=${warehouseId} AND so.status='shipped'
        GROUP BY d.date ORDER BY d.date
      `,
      sql`
        SELECT so.id, so.order_number, so.status, so.priority, so.required_date, p.name AS customer_name, so.created_at
        FROM shipping_orders so LEFT JOIN partners p ON p.id=so.customer_id
        WHERE so.warehouse_id=${warehouseId} ORDER BY so.created_at DESC LIMIT 5
      `,
      sql`
        SELECT i.id AS item_id, i.code AS item_code, i.name AS item_name, i.unit, i.reorder_point,
               SUM(inv.quantity) AS total_qty, SUM(inv.quantity-inv.reserved_qty) AS available_qty
        FROM items i JOIN inventory inv ON inv.item_id=i.id AND inv.warehouse_id=${warehouseId}
        WHERE i.reorder_point IS NOT NULL
        GROUP BY i.id, i.code, i.name, i.unit, i.reorder_point
        HAVING SUM(inv.quantity)<=i.reorder_point
        ORDER BY (SUM(inv.quantity)::float/NULLIF(i.reorder_point,0)) ASC LIMIT 5
      `,
    ]);

    return {
      todayReceiving: Number(todayReceiving[0]?.cnt ?? 0),
      todayShipping: Number(todayShipping[0]?.cnt ?? 0),
      pendingReceiving: Number(pendingReceiving[0]?.cnt ?? 0),
      pendingShipping: Number(pendingShipping[0]?.cnt ?? 0),
      lowStockItems: lowStockItems.length,
      totalSkus: Number(totalSkus[0]?.cnt ?? 0),
      shippingLast7Days: shippingLast7Days.map((r) => ({ date: r.date as string, count: Number(r.count) })),
      recentShippingOrders: recentShippingOrders as never,
      lowStockAlerts: lowStockAlerts.map((r) => ({
        itemId: r.item_id as string,
        itemCode: r.item_code as string,
        itemName: r.item_name as string,
        unit: r.unit as string,
        totalQty: Number(r.total_qty),
        reservedQty: 0,
        availableQty: Number(r.available_qty),
        locationCount: 0,
        reorderPoint: Number(r.reorder_point),
        isLowStock: true,
      })),
    };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const kpi = session?.user?.warehouseId
    ? await getKpiData(session.user.warehouseId as string)
    : null;

  const kpiCards = [
    { label: '今日の入荷完了', value: kpi?.todayReceiving ?? 0, unit: '件', color: 'text-blue-600' },
    { label: '今日の出荷完了', value: kpi?.todayShipping ?? 0, unit: '件', color: 'text-green-600' },
    { label: '入荷処理中', value: kpi?.pendingReceiving ?? 0, unit: '件', color: 'text-yellow-600' },
    { label: '出荷待ち', value: kpi?.pendingShipping ?? 0, unit: '件', color: 'text-orange-600' },
    { label: '管理SKU数', value: kpi?.totalSkus ?? 0, unit: '品目', color: 'text-purple-600' },
    { label: '低在庫アラート', value: kpi?.lowStockItems ?? 0, unit: '品目', color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">ダッシュボード</h1>

      {/* KPIカード */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="py-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.color}`}>
                {card.value.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-gray-500">{card.unit}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 最近の出荷指示 */}
        <Card>
          <CardHeader>
            <CardTitle>最近の出荷指示</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!kpi || kpi.recentShippingOrders.length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-500">データなし</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-50">
                  {kpi.recentShippingOrders.map((order: Record<string, unknown>) => (
                    <tr key={order.id as string} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-blue-600">
                        {order.order_number as string}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 truncate max-w-32">
                        {(order.customer_name as string) ?? '-'}
                      </td>
                      <td className="px-3 py-3">
                        <ShippingStatusBadge status={order.status as string} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* 低在庫アラート */}
        <Card>
          <CardHeader>
            <CardTitle>低在庫アラート</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!kpi || kpi.lowStockAlerts.length === 0 ? (
              <p className="px-6 py-4 text-sm text-gray-500">低在庫商品なし</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-50">
                  {kpi.lowStockAlerts.map((item) => (
                    <tr key={item.itemId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.itemCode}</td>
                      <td className="px-3 py-3 text-sm text-gray-600 truncate max-w-36">{item.itemName}</td>
                      <td className="px-3 py-3 text-sm text-right">
                        <span className="text-red-600 font-bold">{item.availableQty}</span>
                        <span className="text-gray-400 text-xs ml-1">{item.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
