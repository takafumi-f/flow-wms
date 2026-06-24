import type { Plan } from '@/types';

export interface PlanLimits {
  maxOrdersPerMonth: number;
  maxUsers: number;
  maxWarehouses: number;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:         { maxOrdersPerMonth: 100,      maxUsers: 2,        maxWarehouses: 1 },
  starter:      { maxOrdersPerMonth: 3_000,    maxUsers: 10,       maxWarehouses: 1 },
  growth:       { maxOrdersPerMonth: 30_000,   maxUsers: 30,       maxWarehouses: 3 },
  enterprise:   { maxOrdersPerMonth: Infinity, maxUsers: Infinity, maxWarehouses: Infinity },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isWithinPlanLimit(current: number, limit: number): boolean {
  return limit === Infinity || current < limit;
}

export function calcUsagePercent(current: number, limit: number): number {
  if (limit === Infinity || limit === 0) return 0;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function getUpgradeRecommendation(plan: Plan, usagePct: number): Plan | null {
  if (usagePct < 80) return null;
  const order: Plan[] = ['free', 'starter', 'growth', 'enterprise'];
  const idx = order.indexOf(plan);
  return idx < order.length - 1 ? order[idx + 1] : null;
}
