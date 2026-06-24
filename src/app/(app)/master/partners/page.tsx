import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '取引先マスタ' };

async function getPartners(tenantId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT * FROM partners
    WHERE tenant_id = ${tenantId} AND is_active = true
    ORDER BY code
    LIMIT 200
  `;
}

const typeLabel: Record<string, { label: string; variant: 'info' | 'success' | 'default' }> = {
  supplier: { label: '仕入先', variant: 'info' },
  customer: { label: '得意先', variant: 'success' },
  both: { label: '両方', variant: 'default' },
};

export default async function PartnersPage() {
  const session = await auth();
  if (!session?.user) return null;

  const partners = await getPartners(session.user.tenantId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">取引先マスタ</h1>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>取引先コード</Th>
              <Th>取引先名</Th>
              <Th>区分</Th>
              <Th>電話番号</Th>
              <Th>メールアドレス</Th>
              <Th>住所</Th>
            </Tr>
          </Thead>
          <Tbody>
            {partners.length === 0 ? (
              <Tr>
                <Td colSpan={6} className="text-center text-gray-400 py-8">
                  取引先マスタがありません
                </Td>
              </Tr>
            ) : (
              partners.map((partner) => {
                const { label, variant } = typeLabel[partner.type as string] ?? { label: partner.type as string, variant: 'default' };
                return (
                  <Tr key={partner.id as string}>
                    <Td className="font-mono text-xs">{partner.code as string}</Td>
                    <Td className="font-medium">{partner.name as string}</Td>
                    <Td><Badge variant={variant}>{label}</Badge></Td>
                    <Td className="text-gray-500">{(partner.tel as string) ?? '-'}</Td>
                    <Td className="text-gray-500 text-xs">{(partner.email as string) ?? '-'}</Td>
                    <Td className="text-gray-500 text-xs truncate max-w-48">{(partner.address as string) ?? '-'}</Td>
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
