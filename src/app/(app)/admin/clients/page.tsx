import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getPlanLimits, calcUsagePercent } from '@/lib/utils/tenant';
import type { Plan } from '@/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'クライアント管理' };

async function getClients() {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT
      t.id, t.name, t.plan, t.is_active, t.created_at,
      t.max_orders_per_month,
      COUNT(DISTINCT u.id)::int AS user_count,
      COUNT(DISTINCT w.id)::int AS warehouse_count,
      COALESCE(
        (SELECT COUNT(*) FROM shipping_orders so
         JOIN warehouses wh ON wh.id = so.warehouse_id
         WHERE wh.tenant_id = t.id
           AND so.created_at >= date_trunc('month', CURRENT_DATE)),
        0
      )::int AS monthly_orders
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id AND u.is_active = true
    LEFT JOIN warehouses w ON w.tenant_id = t.id AND w.is_active = true
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;
}

const planLabels: Record<Plan, string> = {
  free: 'フリー',
  starter: 'スターター',
  growth: 'グロース',
  enterprise: 'エンタープライズ',
};

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');

  const clients = await getClients();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">クライアント管理（3PL）</h1>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>テナント名</Th>
              <Th>プラン</Th>
              <Th className="text-right">今月受注</Th>
              <Th className="text-right">上限</Th>
              <Th className="text-right">使用率</Th>
              <Th className="text-right">ユーザー数</Th>
              <Th className="text-right">倉庫数</Th>
              <Th>ステータス</Th>
            </Tr>
          </Thead>
          <Tbody>
            {clients.length === 0 ? (
              <Tr>
                <Td colSpan={8} className="text-center text-gray-400 py-8">
                  クライアントがいません
                </Td>
              </Tr>
            ) : (
              clients.map((c) => {
                const plan = c.plan as Plan;
                const limits = getPlanLimits(plan);
                const usagePct = calcUsagePercent(
                  Number(c.monthly_orders),
                  limits.maxOrdersPerMonth,
                );
                return (
                  <Tr key={c.id as string}>
                    <Td className="font-medium">{c.name as string}</Td>
                    <Td>{planLabels[plan]}</Td>
                    <Td className="text-right">{Number(c.monthly_orders).toLocaleString()}</Td>
                    <Td className="text-right text-gray-400">
                      {limits.maxOrdersPerMonth === Infinity ? '無制限' : limits.maxOrdersPerMonth.toLocaleString()}
                    </Td>
                    <Td className="text-right">
                      <span className={usagePct >= 80 ? 'text-red-600 font-bold' : ''}>
                        {usagePct}%
                      </span>
                    </Td>
                    <Td className="text-right">{Number(c.user_count)}</Td>
                    <Td className="text-right">{Number(c.warehouse_count)}</Td>
                    <Td>
                      <Badge variant={c.is_active ? 'success' : 'default'}>
                        {c.is_active ? '有効' : '無効'}
                      </Badge>
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
