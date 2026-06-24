import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { classifyLotStatus } from '@/lib/utils/lot';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ロット・シリアル管理' };

async function getLotInventory(warehouseId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT
      inv.id,
      inv.lot_number,
      inv.serial_number,
      inv.expiry_date,
      inv.quantity,
      inv.reserved_qty,
      inv.quantity - inv.reserved_qty AS available_qty,
      inv.received_at,
      l.code AS location_code,
      i.code AS item_code,
      i.name AS item_name,
      i.unit
    FROM inventory inv
    JOIN locations l ON l.id = inv.location_id
    JOIN items i ON i.id = inv.item_id
    WHERE inv.warehouse_id = ${warehouseId}
      AND (inv.lot_number IS NOT NULL OR inv.serial_number IS NOT NULL)
      AND inv.quantity > 0
    ORDER BY inv.expiry_date ASC NULLS LAST, inv.received_at ASC
    LIMIT 200
  `;
}

const statusLabel: Record<string, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  expired:       { label: '期限切れ', variant: 'danger' },
  expiring_soon: { label: '期限間近', variant: 'warning' },
  valid:         { label: '有効', variant: 'success' },
};

export default async function LotsPage() {
  const session = await auth();
  if (!session?.user?.warehouseId) return null;

  const rows = await getLotInventory(session.user.warehouseId as string);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">ロット・シリアル番号管理</h1>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>商品コード</Th>
              <Th>商品名</Th>
              <Th>ロット番号</Th>
              <Th>シリアル番号</Th>
              <Th>ロケーション</Th>
              <Th className="text-right">有効在庫</Th>
              <Th>賞味期限</Th>
              <Th>ステータス</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="text-center text-gray-400 py-8">
                  ロット・シリアル管理対象の在庫がありません
                </Td>
              </Tr>
            ) : (
              rows.map((row) => {
                const expiryDate = row.expiry_date ? new Date(row.expiry_date as string) : null;
                const status = classifyLotStatus(expiryDate);
                const s = statusLabel[status];
                return (
                  <Tr key={row.id as string}>
                    <Td className="font-mono text-xs">{row.item_code as string}</Td>
                    <Td>{row.item_name as string}</Td>
                    <Td className="font-mono text-xs">{(row.lot_number as string) ?? '-'}</Td>
                    <Td className="font-mono text-xs">{(row.serial_number as string) ?? '-'}</Td>
                    <Td className="font-mono text-xs">{row.location_code as string}</Td>
                    <Td className="text-right">
                      {Number(row.available_qty).toLocaleString()} {row.unit as string}
                    </Td>
                    <Td>
                      {expiryDate
                        ? expiryDate.toLocaleDateString('ja-JP')
                        : '-'}
                    </Td>
                    <Td>
                      {expiryDate && (
                        <Badge variant={s.variant}>{s.label}</Badge>
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
