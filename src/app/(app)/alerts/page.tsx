import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { detectStockDiscrepancy, detectExpiryAlert } from '@/lib/utils/alert';
import type { AlertSeverity } from '@/lib/utils/alert';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'アラート' };

async function getAlertData(warehouseId: string) {
  const { default: sql } = await import('@/lib/db');
  const [stocktakeDiffs, expiryRows] = await Promise.all([
    sql`
      SELECT i.name AS item_name, i.code AS item_code,
             sl.system_qty, sl.counted_qty
      FROM stocktake_lines sl
      JOIN stocktakes st ON st.id = sl.stocktake_id
      JOIN items i ON i.id = sl.item_id
      WHERE st.warehouse_id = ${warehouseId}
        AND st.status = 'completed'
        AND sl.counted_qty IS NOT NULL AND sl.difference != 0
      ORDER BY ABS(sl.difference) DESC LIMIT 50
    `,
    sql`
      SELECT i.name AS item_name, i.code AS item_code,
             inv.lot_number, inv.expiry_date, SUM(inv.quantity) AS qty
      FROM inventory inv
      JOIN items i ON i.id = inv.item_id
      WHERE inv.warehouse_id = ${warehouseId}
        AND inv.expiry_date IS NOT NULL
        AND inv.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        AND inv.quantity > 0
      GROUP BY i.name, i.code, inv.lot_number, inv.expiry_date
      ORDER BY inv.expiry_date ASC LIMIT 50
    `,
  ]);
  return { stocktakeDiffs, expiryRows };
}

const severityStyle: Record<AlertSeverity, { variant: 'danger' | 'warning' | 'info'; label: string }> = {
  critical: { variant: 'danger', label: '緊急' },
  warning:  { variant: 'warning', label: '警告' },
  info:     { variant: 'info', label: '情報' },
};

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const { stocktakeDiffs, expiryRows } = await getAlertData(session.user.warehouseId as string);

  const alerts = [
    ...stocktakeDiffs.flatMap((row) => {
      const a = detectStockDiscrepancy(Number(row.system_qty), Number(row.counted_qty));
      return a ? [{ ...a, itemCode: row.item_code as string }] : [];
    }),
    ...expiryRows.flatMap((row) => {
      const days = Math.ceil((new Date(row.expiry_date as string).getTime() - Date.now()) / 86_400_000);
      const label = `${row.item_name as string}${row.lot_number ? ` [${row.lot_number}]` : ''}`;
      const a = detectExpiryAlert(label, days);
      return a ? [{ ...a, itemCode: row.item_code as string }] : [];
    }),
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">アラート</h1>
        <span className="text-sm text-gray-500">{alerts.length} 件</span>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>重要度</Th>
              <Th>種別</Th>
              <Th>商品コード</Th>
              <Th>内容</Th>
            </Tr>
          </Thead>
          <Tbody>
            {alerts.length === 0 ? (
              <Tr>
                <Td colSpan={4} className="text-center text-gray-400 py-8">アラートなし</Td>
              </Tr>
            ) : (
              alerts.map((a, idx) => {
                const s = severityStyle[a.severity];
                const typeLabel: Record<string, string> = {
                  stock_discrepancy: '在庫差異',
                  expiry: '期限アラート',
                  low_efficiency: '効率低下',
                  low_stock: '低在庫',
                };
                return (
                  <Tr key={idx}>
                    <Td><Badge variant={s.variant}>{s.label}</Badge></Td>
                    <Td className="text-sm text-gray-600">{typeLabel[a.type] ?? a.type}</Td>
                    <Td className="font-mono text-xs">{a.itemCode}</Td>
                    <Td className="text-sm">{a.message}</Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
