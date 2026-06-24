import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { ShippingStatusBadge, Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '出荷管理' };

async function getShippingOrders(warehouseId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT so.*, p.name AS customer_name
    FROM shipping_orders so
    LEFT JOIN partners p ON p.id = so.customer_id
    WHERE so.warehouse_id = ${warehouseId}
    ORDER BY so.priority DESC, so.required_date ASC, so.created_at DESC
    LIMIT 50
  `;
}

function PriorityBadge({ priority }: { priority: number }) {
  if (priority >= 8) return <Badge variant="danger">緊急</Badge>;
  if (priority >= 6) return <Badge variant="warning">高</Badge>;
  return <Badge variant="default">通常</Badge>;
}

export default async function ShippingPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const orders = await getShippingOrders(session.user.warehouseId as string);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">出荷管理</h1>
        <Link href="/shipping/new">
          <Button size="sm">＋ 出荷指示登録</Button>
        </Link>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>出荷番号</Th>
              <Th>顧客</Th>
              <Th>優先度</Th>
              <Th>出荷期日</Th>
              <Th>ステータス</Th>
              <Th>配送業者</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {orders.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="text-center text-gray-400 py-8">
                  出荷指示データがありません
                </Td>
              </Tr>
            ) : (
              orders.map((order) => (
                <Tr key={order.id as string}>
                  <Td className="font-medium text-blue-600">
                    <Link href={`/shipping/${order.id}`}>{order.order_number as string}</Link>
                  </Td>
                  <Td className="truncate max-w-36">{(order.customer_name as string) ?? '-'}</Td>
                  <Td><PriorityBadge priority={Number(order.priority)} /></Td>
                  <Td>
                    {order.required_date
                      ? new Date(order.required_date as string).toLocaleDateString('ja-JP')
                      : '-'}
                  </Td>
                  <Td><ShippingStatusBadge status={order.status as string} /></Td>
                  <Td className="text-gray-500 text-xs uppercase">{(order.shipping_carrier as string) ?? '-'}</Td>
                  <Td>
                    {['pending', 'picking'].includes(order.status as string) && (
                      <Link href={`/shipping/${order.id}/picking`}>
                        <Button variant="ghost" size="sm">ピッキング</Button>
                      </Link>
                    )}
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
