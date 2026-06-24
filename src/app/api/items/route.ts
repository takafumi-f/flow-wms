import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError, paginate } from '@/lib/api-helpers';
import { ItemSchema, PaginationSchema } from '@/lib/schemas';
import sql from '@/lib/db';
import { z } from 'zod';

const QuerySchema = PaginationSchema.extend({
  q: z.string().optional(),
  category: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = QuerySchema.safeParse(params);
  if (!query.success) return apiError('Invalid query parameters', 400);

  const { page, limit, q, category } = query.data;
  const offset = (page - 1) * limit;

  const rows = await sql`
    SELECT *, COUNT(*) OVER() AS total_count
    FROM items
    WHERE tenant_id = ${user.tenantId}
      AND is_active = true
      ${q ? sql`AND (code ILIKE ${'%' + q + '%'} OR name ILIKE ${'%' + q + '%'})` : sql``}
      ${category ? sql`AND category = ${category}` : sql``}
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
  const parsed = ItemSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  try {
    const [item] = await sql`
      INSERT INTO items (
        tenant_id, code, name, name_kana, category, unit,
        weight_g, barcode, lot_managed, expiry_managed,
        reorder_point, reorder_qty, unit_price
      ) VALUES (
        ${user.tenantId}, ${parsed.data.code}, ${parsed.data.name},
        ${parsed.data.nameKana ?? null}, ${parsed.data.category ?? null},
        ${parsed.data.unit}, ${parsed.data.weightG ?? null},
        ${parsed.data.barcode ?? null}, ${parsed.data.lotManaged},
        ${parsed.data.expiryManaged}, ${parsed.data.reorderPoint ?? null},
        ${parsed.data.reorderQty ?? null}, ${parsed.data.unitPrice}
      )
      RETURNING *
    `;
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return apiError(`Item code '${parsed.data.code}' already exists`, 409);
    }
    return apiError('Internal server error');
  }
}
