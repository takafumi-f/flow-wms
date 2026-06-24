import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '在庫管理' };

async function getInventorySummary(warehouseId: string, tenantId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT
      i.id AS item_id,
      i.code AS item_code,
      i.name AS item_name,
      i.unit,
      i.reorder_point,
      SUM(inv.quantity) AS total_qty,
      SUM(inv.reserved_qty) AS reserved_qty,
      SUM(inv.quantity - inv.reserved_qty) AS available_qty,
      COUNT(DISTINCT inv.location_id) AS location_count
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE inv.warehouse_id = ${warehouseId}
      AND i.tenant_id = ${tenantId}
    GROUP BY i.id, i.code, i.name, i.unit, i.reorder_point
    ORDER BY i.code
    LIMIT 100
  `;
}

export default async function InventoryPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const inventory = await getInventorySummary(
    session.user.warehouseId as string,
    session.user.tenantId,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">在庫管理</h1>
        <Link href="/inventory/move">
          <Button variant="secondary" size="sm">在庫移動</Button>
        </Link>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>商品コード</Th>
              <Th>商品名</Th>
              <Th className="text-right">実在庫数</Th>
              <Th className="text-right">引当数</Th>
              <Th className="text-right">有効在庫</Th>
              <Th className="text-right">ロケーション数</Th>
              <Th>アラート</Th>
            </Tr>
          </Thead>
          <Tbody>
            {inventory.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="text-center text-gray-400 py-8">
                  在庫データがありません
                </Td>
              </Tr>
            ) : (
              inventory.map((row) => {
                const isLowStock =
                  row.reorder_point !== null &&
                  Number(row.total_qty) <= Number(row.reorder_point);
                return (
                  <Tr key={row.item_id as string}>
                    <Td className="font-mono text-xs">{row.item_code as string}</Td>
                    <Td>{row.item_name as string}</Td>
                    <Td className="text-right">
                      {Number(row.total_qty).toLocaleString()} {row.unit as string}
                    </Td>
                    <Td className="text-right text-gray-500">
                      {Number(row.reserved_qty).toLocaleString()}
                    </Td>
                    <Td className="text-right font-medium">
                      {Number(row.available_qty).toLocaleString()}
                    </Td>
                    <Td className="text-right">{Number(row.location_count)}</Td>
                    <Td>
                      {isLowStock && (
                        <Badge variant="danger">低在庫</Badge>
                      )}
                    </Td>
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
