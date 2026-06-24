import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { ReceivingStatusBadge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '入荷詳細' };

async function getOrder(id: string, warehouseId: string) {
  const { default: sql } = await import('@/lib/db');
  const [order] = await sql`
    SELECT ro.*, p.name AS supplier_name
    FROM receiving_orders ro
    LEFT JOIN partners p ON p.id = ro.supplier_id
    WHERE ro.id = ${id} AND ro.warehouse_id = ${warehouseId}
  `;
  if (!order) return null;

  const lines = await sql`
    SELECT rol.*, i.code AS item_code, i.name AS item_name, i.unit, l.code AS location_code
    FROM receiving_order_lines rol
    JOIN items i ON i.id = rol.item_id
    LEFT JOIN locations l ON l.id = rol.location_id
    WHERE rol.receiving_order_id = ${id}
    ORDER BY rol.created_at
  `;

  return { ...order, lines };
}

export default async function ReceivingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const order = await getOrder(id, session.user.warehouseId as string);
  if (!order) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/receiving" className="text-sm text-blue-600 hover:underline">
            ← 入荷一覧へ
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-gray-900">
            {order.order_number as string}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <ReceivingStatusBadge status={order.status as string} />
          {['pending', 'in_progress'].includes(order.status as string) && (
            <Link href={`/receiving/${id}/inspect`}>
              <Button size="sm">検品を開始</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>基本情報</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">仕入先</dt>
              <dd className="font-medium">{(order.supplier_name as string) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">入荷予定日</dt>
              <dd className="font-medium">
                {order.expected_date
                  ? new Date(order.expected_date as string).toLocaleDateString('ja-JP')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">入荷完了日</dt>
              <dd className="font-medium">
                {order.received_at
                  ? new Date(order.received_at as string).toLocaleString('ja-JP')
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">備考</dt>
              <dd>{(order.note as string) ?? '-'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>入荷明細</CardTitle></CardHeader>
        <Table>
          <Thead>
            <Tr>
              <Th>商品コード</Th>
              <Th>商品名</Th>
              <Th className="text-right">発注数</Th>
              <Th className="text-right">入荷数</Th>
              <Th>ロット番号</Th>
              <Th>格納ロケーション</Th>
            </Tr>
          </Thead>
          <Tbody>
            {(order.lines as Record<string, unknown>[]).map((line) => (
              <Tr key={line.id as string}>
                <Td className="font-mono text-xs">{line.item_code as string}</Td>
                <Td>{line.item_name as string}</Td>
                <Td className="text-right">{Number(line.ordered_qty).toLocaleString()} {line.unit as string}</Td>
                <Td className="text-right">
                  <span className={Number(line.received_qty) >= Number(line.ordered_qty) ? 'text-green-600 font-bold' : ''}>
                    {Number(line.received_qty).toLocaleString()} {line.unit as string}
                  </span>
                </Td>
                <Td className="font-mono text-xs">{(line.lot_number as string) ?? '-'}</Td>
                <Td className="font-mono text-xs">{(line.location_code as string) ?? '未格納'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
