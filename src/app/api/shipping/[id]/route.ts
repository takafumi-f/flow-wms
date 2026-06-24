import { NextRequest, NextResponse } from 'next/server';
import { requireSession, isSessionUser, apiError } from '@/lib/api-helpers';
import sql from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const { id } = await params;

  const [order] = await sql`
    SELECT so.*, p.name AS customer_name
    FROM shipping_orders so
    LEFT JOIN partners p ON p.id = so.customer_id
    WHERE so.id = ${id}
      AND so.warehouse_id = ${user.warehouseId!}
  `;

  if (!order) return apiError('Not found', 404);

  const lines = await sql`
    SELECT sol.*, i.code AS item_code, i.name AS item_name, i.unit,
           l.code AS location_code
    FROM shipping_order_lines sol
    JOIN items i ON i.id = sol.item_id
    LEFT JOIN locations l ON l.id = sol.location_id
    WHERE sol.shipping_order_id = ${id}
    ORDER BY sol.created_at
  `;

  return NextResponse.json({ ...order, lines });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSession();
  if (!isSessionUser(user)) return user;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return apiError('Invalid body', 400);

  const allowedStatuses = ['pending', 'picking', 'packed', 'shipped', 'cancelled'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return apiError('Invalid status', 400);
  }

  const sets: Record<string, unknown> = {};
  if (body.status) sets.status = body.status;
  if (body.trackingNumber) sets.tracking_number = body.trackingNumber;
  if (body.status === 'shipped') sets.shipped_at = new Date();

  const [updated] = await sql`
    UPDATE shipping_orders
    SET status = COALESCE(${body.status ?? null}, status),
        tracking_number = COALESCE(${body.trackingNumber ?? null}, tracking_number),
        shipped_at = CASE WHEN ${body.status ?? ''} = 'shipped' THEN NOW() ELSE shipped_at END
    WHERE id = ${id}
      AND warehouse_id = ${user.warehouseId!}
    RETURNING *
  `;

  if (!updated) return apiError('Not found', 404);
  return NextResponse.json(updated);
}
