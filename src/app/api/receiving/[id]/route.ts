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
    SELECT ro.*, p.name AS supplier_name
    FROM receiving_orders ro
    LEFT JOIN partners p ON p.id = ro.supplier_id
    WHERE ro.id = ${id}
      AND ro.warehouse_id = ${user.warehouseId!}
  `;

  if (!order) return apiError('Not found', 404);

  const lines = await sql`
    SELECT rol.*, i.code AS item_code, i.name AS item_name, i.unit,
           l.code AS location_code
    FROM receiving_order_lines rol
    JOIN items i ON i.id = rol.item_id
    LEFT JOIN locations l ON l.id = rol.location_id
    WHERE rol.receiving_order_id = ${id}
    ORDER BY rol.created_at
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

  const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    return apiError('Invalid status', 400);
  }

  const [updated] = await sql`
    UPDATE receiving_orders
    SET status = COALESCE(${body.status ?? null}, status),
        note = COALESCE(${body.note ?? null}, note)
    WHERE id = ${id}
      AND warehouse_id = ${user.warehouseId!}
    RETURNING *
  `;

  if (!updated) return apiError('Not found', 404);
  return NextResponse.json(updated);
}
