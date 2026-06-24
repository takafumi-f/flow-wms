import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError, paginate } from '@/lib/api-helpers';
import { ReceivingOrderSchema, ReceivingQuerySchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = ReceivingQuerySchema.safeParse(params);
  if (!query.success) return apiError('Invalid query parameters', 400, query.error.flatten());

  const { page, limit, status, dateFrom, dateTo } = query.data;
  const offset = (page - 1) * limit;

  const rows = await sql`
    SELECT ro.*, p.name AS supplier_name,
           COUNT(*) OVER() AS total_count
    FROM receiving_orders ro
    LEFT JOIN partners p ON p.id = ro.supplier_id
    WHERE ro.warehouse_id = ${user.warehouseId!}
      ${status ? sql`AND ro.status = ${status}` : sql``}
      ${dateFrom ? sql`AND ro.expected_date >= ${dateFrom}` : sql``}
      ${dateTo ? sql`AND ro.expected_date <= ${dateTo}` : sql``}
    ORDER BY ro.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count: _, ...r }) => r);

  return paginate(data, total, page, limit);
}

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  if (!user.warehouseId) return apiError('No warehouse assigned', 403);

  const body = await req.json().catch(() => null);
  const parsed = ReceivingOrderSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  const { orderNumber, supplierId, expectedDate, note, lines } = parsed.data;

  try {
    const [order] = await sql.begin(async (tx) => {
      const [ro] = await tx`
        INSERT INTO receiving_orders (
          warehouse_id, order_number, supplier_id, expected_date, note, created_by
        ) VALUES (
          ${user.warehouseId!}, ${orderNumber},
          ${supplierId ?? null}, ${expectedDate ?? null},
          ${note ?? null}, ${user.id}
        )
        RETURNING *
      `;

      for (const line of lines) {
        await tx`
          INSERT INTO receiving_order_lines (
            receiving_order_id, item_id, ordered_qty, lot_number, expiry_date
          ) VALUES (
            ${ro.id}, ${line.itemId}, ${line.orderedQty},
            ${line.lotNumber ?? null}, ${line.expiryDate ?? null}
          )
        `;
      }

      return [ro];
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return apiError(`Order number '${orderNumber}' already exists`, 409);
    }
    console.error('[POST /api/receiving]', err);
    return apiError('Internal server error');
  }
}
