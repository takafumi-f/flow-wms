import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ユーザー管理' };

async function getUsers(tenantId: string) {
  const { default: sql } = await import('@/lib/db');
  return sql`
    SELECT u.id, u.email, u.name, u.role, u.is_active, u.last_login_at, u.created_at,
           w.name AS warehouse_name
    FROM users u
    LEFT JOIN warehouses w ON w.id = u.warehouse_id
    WHERE u.tenant_id = ${tenantId}
    ORDER BY u.created_at
    LIMIT 100
  `;
}

const roleLabel: Record<string, string> = {
  admin: '管理者',
  manager: 'マネージャー',
  operator: 'オペレーター',
  viewer: '閲覧者',
};

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role !== 'admin') redirect('/');

  const users = await getUsers(session.user.tenantId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">ユーザー管理</h1>
      </div>

      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>名前</Th>
              <Th>メールアドレス</Th>
              <Th>権限</Th>
              <Th>担当倉庫</Th>
              <Th>最終ログイン</Th>
              <Th>状態</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.map((user) => (
              <Tr key={user.id as string}>
                <Td className="font-medium">{user.name as string}</Td>
                <Td className="text-gray-500 text-xs">{user.email as string}</Td>
                <Td>{roleLabel[user.role as string] ?? user.role as string}</Td>
                <Td className="text-gray-500">{(user.warehouse_name as string) ?? '全倉庫'}</Td>
                <Td className="text-gray-500 text-xs">
                  {user.last_login_at
                    ? new Date(user.last_login_at as string).toLocaleString('ja-JP')
                    : '未ログイン'}
                </Td>
                <Td>
                  <Badge variant={user.is_active ? 'success' : 'danger'}>
                    {user.is_active ? '有効' : '無効'}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
