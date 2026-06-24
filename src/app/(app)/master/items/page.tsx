import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '商品マスタ' };

async function getItems(tenantId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT * FROM items
    WHERE tenant_id = ${tenantId} AND is_active = true
    ORDER BY code
    LIMIT 200
  `;
}

export default async function ItemsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const items = await getItems(session.user.tenantId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">商品マスタ</h1>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>商品コード</Th>
              <Th>商品名</Th>
              <Th>カテゴリ</Th>
              <Th>単位</Th>
              <Th>重量(g)</Th>
              <Th>バーコード</Th>
              <Th>管理方式</Th>
              <Th className="text-right">発注点</Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="text-center text-gray-400 py-8">
                  商品マスタがありません
                </Td>
              </Tr>
            ) : (
              items.map((item) => (
                <Tr key={item.id as string}>
                  <Td className="font-mono text-xs">{item.code as string}</Td>
                  <Td className="font-medium">{item.name as string}</Td>
                  <Td className="text-gray-500">{(item.category as string) ?? '-'}</Td>
                  <Td>{item.unit as string}</Td>
                  <Td className="text-right">{item.weight_g != null ? Number(item.weight_g).toLocaleString() : '-'}</Td>
                  <Td className="font-mono text-xs">{(item.barcode as string) ?? '-'}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {item.lot_managed && <Badge variant="info">ロット</Badge>}
                      {item.expiry_managed && <Badge variant="warning">期限</Badge>}
                      {item.serial_managed && <Badge variant="default">シリアル</Badge>}
                      {!item.lot_managed && !item.expiry_managed && !item.serial_managed && (
                        <span className="text-xs text-gray-400">なし</span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-right">
                    {item.reorder_point != null ? Number(item.reorder_point).toLocaleString() : '-'}
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
