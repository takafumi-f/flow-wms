import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError, paginate } from '@/lib/api-helpers';
import { PartnerSchema, PaginationSchema } from '@/lib/schemas';
import sql from '@/lib/db';
import { z } from 'zod';

const QuerySchema = PaginationSchema.extend({
  q: z.string().optional(),
  type: z.enum(['supplier', 'customer', 'both']).optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = QuerySchema.safeParse(params);
  if (!query.success) return apiError('Invalid query parameters', 400);

  const { page, limit, q, type } = query.data;
  const offset = (page - 1) * limit;

  const rows = await sql`
    SELECT *, COUNT(*) OVER() AS total_count
    FROM partners
    WHERE tenant_id = ${user.tenantId}
      AND is_active = true
      ${q ? sql`AND (code ILIKE ${'%' + q + '%'} OR name ILIKE ${'%' + q + '%'})` : sql``}
      ${type ? sql`AND (type = ${type} OR type = 'both')` : sql``}
    ORDER BY code
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count: _, ...r }) => r);

  return paginate(data, total, page, limit);
}

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  if (!['admin', 'manager'].includes(user.role)) {
    return apiError('Forbidden', 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = PartnerSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  try {
    const [partner] = await sql`
      INSERT INTO partners (
        tenant_id, code, name, type, postal_code,
        address, tel, email, contact_name
      ) VALUES (
        ${user.tenantId}, ${parsed.data.code}, ${parsed.data.name},
        ${parsed.data.type}, ${parsed.data.postalCode ?? null},
        ${parsed.data.address ?? null}, ${parsed.data.tel ?? null},
        ${parsed.data.email ?? null}, ${parsed.data.contactName ?? null}
      )
      RETURNING *
    `;
    return NextResponse.json(partner, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return apiError(`Partner code '${parsed.data.code}' already exists`, 409);
    }
    return apiError('Internal server error');
  }
}
