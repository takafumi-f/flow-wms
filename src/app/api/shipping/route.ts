import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError, paginate } from '@/lib/api-helpers';
import { ShippingOrderSchema, ShippingQuerySchema } from '@/lib/schemas';
import sql from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const query = ShippingQuerySchema.safeParse(params);
  if (!query.success) return apiError('Invalid query parameters', 400, query.error.flatten());

  const { page, limit, status, dateFrom, dateTo } = query.data;
  const offset = (page - 1) * limit;

  const rows = await sql`
    SELECT so.*, p.name AS customer_name,
           COUNT(*) OVER() AS total_count
    FROM shipping_orders so
    LEFT JOIN partners p ON p.id = so.customer_id
    WHERE so.warehouse_id = ${user.warehouseId!}
      ${status ? sql`AND so.status = ${status}` : sql``}
      ${dateFrom ? sql`AND so.required_date >= ${dateFrom}` : sql``}
      ${dateTo ? sql`AND so.required_date <= ${dateTo}` : sql``}
    ORDER BY so.priority DESC, so.required_date ASC, so.created_at DESC
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
  const parsed = ShippingOrderSchema.safeParse(body);
  if (!parsed.success) return apiError('Validation error', 400, parsed.error.flatten());

  const {
    orderNumber, customerId, pickingMethod, priority,
    requiredDate, shippingCarrier, shipToName, shipToPostal,
    shipToAddress, shipToTel, note, lines,
  } = parsed.data;

  try {
    const [order] = await sql.begin(async (tx) => {
      const [so] = await tx`
        INSERT INTO shipping_orders (
          warehouse_id, order_number, customer_id, picking_method,
          priority, required_date, shipping_carrier,
          ship_to_name, ship_to_postal, ship_to_address, ship_to_tel,
          note, created_by
        ) VALUES (
          ${user.warehouseId!}, ${orderNumber}, ${customerId ?? null},
          ${pickingMethod}, ${priority}, ${requiredDate ?? null},
          ${shippingCarrier ?? null},
          ${shipToName ?? null}, ${shipToPostal ?? null},
          ${shipToAddress ?? null}, ${shipToTel ?? null},
          ${note ?? null}, ${user.id}
        )
        RETURNING *
      `;

      for (const line of lines) {
        await tx`
          INSERT INTO shipping_order_lines (
            shipping_order_id, item_id, ordered_qty
          ) VALUES (${so.id}, ${line.itemId}, ${line.orderedQty})
        `;
      }

      return [so];
    });

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return apiError(`Order number '${orderNumber}' already exists`, 409);
    }
    console.error('[POST /api/shipping]', err);
    return apiError('Internal server error');
  }
}
