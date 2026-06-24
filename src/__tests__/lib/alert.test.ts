import {
  classifyDiscrepancySeverity,
  detectStockDiscrepancy,
  detectEfficiencyDrop,
  detectExpiryAlert,
} from '@/lib/utils/alert';

describe('classifyDiscrepancySeverity', () => {
  it('returns info for small difference', () => {
    expect(classifyDiscrepancySeverity(0)).toBe('info');
    expect(classifyDiscrepancySeverity(4.9)).toBe('info');
  });

  it('returns warning for 5–19%', () => {
    expect(classifyDiscrepancySeverity(5)).toBe('warning');
    expect(classifyDiscrepancySeverity(19)).toBe('warning');
  });

  it('returns critical for 20% or more', () => {
    expect(classifyDiscrepancySeverity(20)).toBe('critical');
    expect(classifyDiscrepancySeverity(100)).toBe('critical');
  });
});

describe('detectStockDiscrepancy', () => {
  it('returns null when both are zero', () => {
    expect(detectStockDiscrepancy(0, 0)).toBeNull();
  });

  it('returns null when difference is below threshold', () => {
    // diff = |100 - 96| / 100 * 100 = 4% < 5%
    expect(detectStockDiscrepancy(100, 96)).toBeNull();
  });

  it('returns alert when difference meets threshold', () => {
    // diff = |100 - 90| / 100 * 100 = 10%
    const alert = detectStockDiscrepancy(100, 90);
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('stock_discrepancy');
    expect(alert?.severity).toBe('warning');
  });

  it('returns critical when difference >= 20%', () => {
    const alert = detectStockDiscrepancy(100, 70);
    expect(alert?.severity).toBe('critical');
  });

  it('uses custom threshold', () => {
    // diff = |100 - 92| / 100 * 100 = 8%
    expect(detectStockDiscrepancy(100, 92, 10)).toBeNull();
    expect(detectStockDiscrepancy(100, 92, 5)).not.toBeNull();
  });

  it('handles system_qty=0 with discrepancy using base=1', () => {
    // systemQty=0, countedQty=5: base=max(0,1)=1, diff=500%
    const alert = detectStockDiscrepancy(0, 5);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe('critical');
  });

  it('includes metadata in result', () => {
    const alert = detectStockDiscrepancy(100, 50);
    expect(alert?.metadata).toMatchObject({ systemQty: 100, countedQty: 50 });
  });
});

describe('detectEfficiencyDrop', () => {
  it('returns null when baseline is zero', () => {
    expect(detectEfficiencyDrop(50, 0)).toBeNull();
  });

  it('returns null when drop is below threshold', () => {
    // drop = (100 - 85) / 100 * 100 = 15% < 20%
    expect(detectEfficiencyDrop(85, 100)).toBeNull();
  });

  it('returns warning alert for 20–39% drop', () => {
    // drop = (100 - 75) / 100 * 100 = 25%
    const alert = detectEfficiencyDrop(75, 100);
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('low_efficiency');
    expect(alert?.severity).toBe('warning');
  });

  it('returns critical alert for 40%+ drop', () => {
    // drop = (100 - 50) / 100 * 100 = 50%
    const alert = detectEfficiencyDrop(50, 100);
    expect(alert?.severity).toBe('critical');
  });

  it('uses custom threshold', () => {
    // drop = 25%, threshold = 30% → null
    expect(detectEfficiencyDrop(75, 100, 30)).toBeNull();
  });
});

describe('detectExpiryAlert', () => {
  it('returns null when days exceed warnDays', () => {
    expect(detectExpiryAlert('item-A', 31, 30)).toBeNull();
    expect(detectExpiryAlert('item-A', 30, 30)).not.toBeNull();
  });

  it('returns warning for upcoming expiry', () => {
    const alert = detectExpiryAlert('item-A', 10);
    expect(alert?.type).toBe('expiry');
    expect(alert?.severity).toBe('warning');
  });

  it('returns critical for already expired', () => {
    const alert = detectExpiryAlert('item-A', -1);
    expect(alert?.severity).toBe('critical');
  });

  it('includes item name in message', () => {
    const alert = detectExpiryAlert('テスト商品', 5);
    expect(alert?.message).toContain('テスト商品');
  });

  it('uses custom warnDays', () => {
    expect(detectExpiryAlert('item', 60, 90)).not.toBeNull();
    expect(detectExpiryAlert('item', 60, 30)).toBeNull();
  });
});
