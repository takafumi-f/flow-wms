import { auth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'クライアントポータル' };

async function getPortalData(warehouseId: string, tenantId: string) {
  const { default: sql } = await import('@/lib/db');
  const [inventorySummary, recentReceiving, recentShipping] = await Promise.all([
    sql`
      SELECT
        i.code AS item_code, i.name AS item_name, i.unit,
        SUM(inv.quantity) AS total_qty,
        SUM(inv.quantity - inv.reserved_qty) AS available_qty
      FROM inventory inv
      JOIN items i ON i.id = inv.item_id
      WHERE inv.warehouse_id = ${warehouseId}
        AND i.tenant_id = ${tenantId}
      GROUP BY i.id, i.code, i.name, i.unit
      ORDER BY i.code
      LIMIT 50
    `,
    sql`
      SELECT order_number, status, expected_date, received_at
      FROM receiving_orders
      WHERE warehouse_id = ${warehouseId}
      ORDER BY created_at DESC LIMIT 10
    `,
    sql`
      SELECT order_number, status, required_date, shipped_at, tracking_number
      FROM shipping_orders
      WHERE warehouse_id = ${warehouseId}
      ORDER BY created_at DESC LIMIT 10
    `,
  ]);
  return { inventorySummary, recentReceiving, recentShipping };
}

export default async function PortalPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const { inventorySummary, recentReceiving, recentShipping } = await getPortalData(
    session.user.warehouseId as string,
    session.user.tenantId,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">クライアントポータル</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 直近の入荷 */}
        <Card>
          <CardHeader><CardTitle>直近の入荷</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>伝票番号</Th>
                  <Th>ステータス</Th>
                  <Th>入荷日</Th>
                </Tr>
              </Thead>
              <Tbody>
                {recentReceiving.length === 0 ? (
                  <Tr><Td colSpan={3} className="text-center text-gray-400 py-4">データなし</Td></Tr>
                ) : recentReceiving.map((r) => (
                  <Tr key={r.id as string}>
                    <Td className="font-mono text-xs">{r.order_number as string}</Td>
                    <Td>{r.status as string}</Td>
                    <Td>{r.received_at ? new Date(r.received_at as string).toLocaleDateString('ja-JP') : '-'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>

        {/* 直近の出荷 */}
        <Card>
          <CardHeader><CardTitle>直近の出荷</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead>
                <Tr>
                  <Th>伝票番号</Th>
                  <Th>ステータス</Th>
                  <Th>出荷日</Th>
                </Tr>
              </Thead>
              <Tbody>
                {recentShipping.length === 0 ? (
                  <Tr><Td colSpan={3} className="text-center text-gray-400 py-4">データなし</Td></Tr>
                ) : recentShipping.map((s) => (
                  <Tr key={s.id as string}>
                    <Td className="font-mono text-xs">{s.order_number as string}</Td>
                    <Td>{s.status as string}</Td>
                    <Td>{s.shipped_at ? new Date(s.shipped_at as string).toLocaleDateString('ja-JP') : '-'}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 在庫サマリ */}
      <Card>
        <CardHeader><CardTitle>在庫サマリ</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>商品コード</Th>
                <Th>商品名</Th>
                <Th className="text-right">実在庫</Th>
                <Th className="text-right">有効在庫</Th>
              </Tr>
            </Thead>
            <Tbody>
              {inventorySummary.length === 0 ? (
                <Tr><Td colSpan={4} className="text-center text-gray-400 py-4">在庫データなし</Td></Tr>
              ) : inventorySummary.map((row) => (
                <Tr key={row.item_code as string}>
                  <Td className="font-mono text-xs">{row.item_code as string}</Td>
                  <Td>{row.item_name as string}</Td>
                  <Td className="text-right">{Number(row.total_qty).toLocaleString()} {row.unit as string}</Td>
                  <Td className="text-right font-medium">{Number(row.available_qty).toLocaleString()} {row.unit as string}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
