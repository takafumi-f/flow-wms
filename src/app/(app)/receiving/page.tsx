import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { ReceivingStatusBadge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '入荷管理' };

async function getReceivingOrders(warehouseId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT ro.*, p.name AS supplier_name
    FROM receiving_orders ro
    LEFT JOIN partners p ON p.id = ro.supplier_id
    WHERE ro.warehouse_id = ${warehouseId}
    ORDER BY ro.created_at DESC
    LIMIT 50
  `;
}

export default async function ReceivingPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const orders = await getReceivingOrders(session.user.warehouseId as string);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">入荷管理</h1>
        <Link href="/receiving/new">
          <Button size="sm">＋ 新規入荷予定登録</Button>
        </Link>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>入荷番号</Th>
              <Th>仕入先</Th>
              <Th>予定日</Th>
              <Th>ステータス</Th>
              <Th>登録日</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {orders.length === 0 ? (
              <Tr>
                <Td colSpan={6} className="text-center text-gray-400 py-8">
                  入荷予定データがありません
                </Td>
              </Tr>
            ) : (
              orders.map((order) => (
                <Tr key={order.id as string}>
                  <Td className="font-medium text-blue-600">
                    <Link href={`/receiving/${order.id}`}>{order.order_number as string}</Link>
                  </Td>
                  <Td>{(order.supplier_name as string) ?? '-'}</Td>
                  <Td>
                    {order.expected_date
                      ? new Date(order.expected_date as string).toLocaleDateString('ja-JP')
                      : '-'}
                  </Td>
                  <Td>
                    <ReceivingStatusBadge status={order.status as string} />
                  </Td>
                  <Td className="text-gray-500 text-xs">
                    {new Date(order.created_at as string).toLocaleDateString('ja-JP')}
                  </Td>
                  <Td>
                    <Link href={`/receiving/${order.id}/inspect`}>
                      <Button variant="ghost" size="sm">検品</Button>
                    </Link>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
