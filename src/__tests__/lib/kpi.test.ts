import {
  isLowStock,
  calcShippingUrgency,
  fillMissingDates,
  buildKpiSummary,
} from '@/lib/utils/kpi';

describe('isLowStock', () => {
  it('returns false when reorderPoint is null', () => {
    expect(isLowStock(0, null)).toBe(false);
    expect(isLowStock(100, null)).toBe(false);
  });

  it('returns true when totalQty equals reorderPoint', () => {
    expect(isLowStock(10, 10)).toBe(true);
  });

  it('returns true when totalQty is below reorderPoint', () => {
    expect(isLowStock(5, 10)).toBe(true);
  });

  it('returns false when totalQty is above reorderPoint', () => {
    expect(isLowStock(11, 10)).toBe(false);
  });

  it('returns true when totalQty is zero and reorderPoint is positive', () => {
    expect(isLowStock(0, 1)).toBe(true);
  });
});

describe('calcShippingUrgency', () => {
  it('returns normal when pending is below warning threshold', () => {
    expect(calcShippingUrgency(0)).toBe('normal');
    expect(calcShippingUrgency(9)).toBe('normal');
  });

  it('returns warning when pending meets the warning threshold', () => {
    expect(calcShippingUrgency(10)).toBe('warning');
    expect(calcShippingUrgency(49)).toBe('warning');
  });

  it('returns critical when pending meets the critical threshold', () => {
    expect(calcShippingUrgency(50)).toBe('critical');
    expect(calcShippingUrgency(100)).toBe('critical');
  });

  it('respects custom thresholds', () => {
    const thresholds = { warning: 5, critical: 20 };
    expect(calcShippingUrgency(4, thresholds)).toBe('normal');
    expect(calcShippingUrgency(5, thresholds)).toBe('warning');
    expect(calcShippingUrgency(19, thresholds)).toBe('warning');
    expect(calcShippingUrgency(20, thresholds)).toBe('critical');
  });
});

describe('fillMissingDates', () => {
  const ref = new Date('2026-06-25T00:00:00.000Z');

  it('returns exactly N dates in ascending order', () => {
    const result = fillMissingDates([], 7, ref);
    expect(result).toHaveLength(7);
    expect(result[0].date).toBe('2026-06-19');
    expect(result[6].date).toBe('2026-06-25');
  });

  it('fills missing dates with count 0', () => {
    const rows = [{ date: '2026-06-25', count: 5 }];
    const result = fillMissingDates(rows, 3, ref);
    expect(result).toEqual([
      { date: '2026-06-23', count: 0 },
      { date: '2026-06-24', count: 0 },
      { date: '2026-06-25', count: 5 },
    ]);
  });

  it('preserves existing counts', () => {
    const rows = [
      { date: '2026-06-24', count: 3 },
      { date: '2026-06-25', count: 7 },
    ];
    const result = fillMissingDates(rows, 2, ref);
    expect(result[0]).toEqual({ date: '2026-06-24', count: 3 });
    expect(result[1]).toEqual({ date: '2026-06-25', count: 7 });
  });

  it('returns empty array when days is 0', () => {
    expect(fillMissingDates([], 0, ref)).toEqual([]);
  });

  it('ignores rows outside the requested date range', () => {
    const rows = [{ date: '2026-01-01', count: 99 }];
    const result = fillMissingDates(rows, 3, ref);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it('handles multiple missing gaps correctly', () => {
    const rows = [
      { date: '2026-06-19', count: 2 },
      { date: '2026-06-25', count: 8 },
    ];
    const result = fillMissingDates(rows, 7, ref);
    expect(result[0]).toEqual({ date: '2026-06-19', count: 2 });
    expect(result[1]).toEqual({ date: '2026-06-20', count: 0 });
    expect(result[6]).toEqual({ date: '2026-06-25', count: 8 });
  });
});

describe('buildKpiSummary', () => {
  const base = {
    todayReceiving: 5,
    todayShipping: 10,
    pendingReceiving: 2,
    pendingShipping: 3,
    lowStockItems: 1,
    totalSkus: 100,
  };

  it('includes all raw fields unchanged', () => {
    const result = buildKpiSummary(base);
    expect(result.todayReceiving).toBe(5);
    expect(result.todayShipping).toBe(10);
    expect(result.pendingReceiving).toBe(2);
    expect(result.pendingShipping).toBe(3);
    expect(result.lowStockItems).toBe(1);
    expect(result.totalSkus).toBe(100);
  });

  it('derives shippingUrgency as normal when pendingShipping < 10', () => {
    expect(buildKpiSummary({ ...base, pendingShipping: 3 }).shippingUrgency).toBe('normal');
  });

  it('derives shippingUrgency as warning when pendingShipping is 10–49', () => {
    expect(buildKpiSummary({ ...base, pendingShipping: 15 }).shippingUrgency).toBe('warning');
  });

  it('derives shippingUrgency as critical when pendingShipping >= 50', () => {
    expect(buildKpiSummary({ ...base, pendingShipping: 60 }).shippingUrgency).toBe('critical');
  });
});
