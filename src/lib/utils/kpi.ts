export type UrgencyLevel = 'normal' | 'warning' | 'critical';

export interface UrgencyThresholds {
  warning: number;
  critical: number;
}

const DEFAULT_SHIPPING_THRESHOLDS: UrgencyThresholds = { warning: 10, critical: 50 };

export function isLowStock(totalQty: number, reorderPoint: number | null): boolean {
  if (reorderPoint === null) return false;
  return totalQty <= reorderPoint;
}

export function calcShippingUrgency(
  pendingShipping: number,
  thresholds: UrgencyThresholds = DEFAULT_SHIPPING_THRESHOLDS,
): UrgencyLevel {
  if (pendingShipping >= thresholds.critical) return 'critical';
  if (pendingShipping >= thresholds.warning) return 'warning';
  return 'normal';
}

export function fillMissingDates(
  rows: Array<{ date: string; count: number }>,
  days: number,
  referenceDate: Date = new Date(),
): Array<{ date: string; count: number }> {
  const map = new Map(rows.map((r) => [r.date, r.count]));
  const result: Array<{ date: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(referenceDate);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
  }
  return result;
}

export function buildKpiSummary(raw: {
  todayReceiving: number;
  todayShipping: number;
  pendingReceiving: number;
  pendingShipping: number;
  lowStockItems: number;
  totalSkus: number;
}) {
  return {
    ...raw,
    shippingUrgency: calcShippingUrgency(raw.pendingShipping),
  };
}
