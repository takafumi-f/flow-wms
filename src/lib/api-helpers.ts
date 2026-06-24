import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { SessionUser } from '@/types';

export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session.user as SessionUser;
}

export function isSessionUser(val: unknown): val is SessionUser {
  return typeof val === 'object' && val !== null && 'tenantId' in val;
}

export function apiError(message: string, status = 500, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return NextResponse.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
