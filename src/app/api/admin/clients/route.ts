import { NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';

export async function GET() {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;
  if (user.role !== 'admin') return apiError('Forbidden', 403);

  const rows = await sql`
    SELECT
      t.id,
      t.name,
      t.plan,
      t.is_active,
      t.max_orders_per_month,
      t.max_users,
      t.max_warehouses,
      t.created_at,
      COUNT(DISTINCT u.id) AS user_count,
      COUNT(DISTINCT w.id) AS warehouse_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id AND u.is_active = true
    LEFT JOIN warehouses w ON w.tenant_id = t.id AND w.is_active = true
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;

  return NextResponse.json(rows);
}
