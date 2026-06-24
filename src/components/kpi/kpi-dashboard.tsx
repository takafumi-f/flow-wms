'use client';

import { useKpiPolling } from '@/hooks/useKpiPolling';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShippingStatusBadge } from '@/components/ui/badge';
import { buildKpiSummary, type UrgencyLevel } from '@/lib/utils/kpi';

function urgencyColor(level: UrgencyLevel): string {
  if (level === 'critical') return 'text-red-600';
  if (level === 'warning') return 'text-red-500';
  return 'text-orange-600';
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function KpiSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-48 rounded-lg bg-gray-200" />
        <div className="h-48 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

export function KpiDashboard() {
  const { data, loading, lastUpdatedAt, refresh } = useKpiPolling();

  const summary = data
    ? buildKpiSummary({
        todayReceiving: data.todayReceiving,
        todayShipping: data.todayShipping,
        pendingReceiving: data.pendingReceiving,
        pendingShipping: data.pendingShipping,
        lowStockItems: data.lowStockItems,
        totalSkus: data.totalSkus,
      })
    : null;

  const kpiCards = [
    { label: '今日の入荷完了', value: summary?.todayReceiving ?? 0, unit: '件', color: 'text-blue-600' },
    { label: '今日の出荷完了', value: summary?.todayShipping ?? 0, unit: '件', color: 'text-green-600' },
    { label: '入荷処理中', value: summary?.pendingReceiving ?? 0, unit: '件', color: 'text-yellow-600' },
    {
      label: '出荷待ち',
      value: summary?.pendingShipping ?? 0,
      unit: '件',
      color: summary ? urgencyColor(summary.shippingUrgency) : 'text-orange-600',
    },
    { label: '管理SKU数', value: summary?.totalSkus ?? 0, unit: '品目', color: 'text-purple-600' },
    { label: '低在庫アラート', value: summary?.lowStockItems ?? 0, unit: '品目', color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ダッシュボード</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {lastUpdatedAt && (
            <span>最終更新: {lastUpdatedAt.toLocaleTimeString('ja-JP')}</span>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <RefreshIcon className="h-4 w-4" />
            更新
          </button>
        </div>
      </div>

      {loading ? (
        <KpiSkeleton />
      ) : (
        <>
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
            <Card>
              <CardHeader>
                <CardTitle>最近の出荷指示</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data || data.recentShippingOrders.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-gray-500">データなし</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-100">
                    <tbody className="divide-y divide-gray-50">
                      {data.recentShippingOrders.map((order: Record<string, unknown>) => (
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

            <Card>
              <CardHeader>
                <CardTitle>低在庫アラート</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data || data.lowStockAlerts.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-gray-500">低在庫商品なし</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-100">
                    <tbody className="divide-y divide-gray-50">
                      {data.lowStockAlerts.map((item) => (
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
        </>
      )}
    </div>
  );
}
