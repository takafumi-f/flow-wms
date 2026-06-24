import {
  getPlanLimits,
  isWithinPlanLimit,
  calcUsagePercent,
  getUpgradeRecommendation,
} from '@/lib/utils/tenant';

describe('getPlanLimits', () => {
  it('returns correct limits for free plan', () => {
    const limits = getPlanLimits('free');
    expect(limits.maxOrdersPerMonth).toBe(100);
    expect(limits.maxUsers).toBe(2);
    expect(limits.maxWarehouses).toBe(1);
  });

  it('returns correct limits for starter plan', () => {
    const limits = getPlanLimits('starter');
    expect(limits.maxOrdersPerMonth).toBe(3000);
    expect(limits.maxUsers).toBe(10);
    expect(limits.maxWarehouses).toBe(1);
  });

  it('returns correct limits for growth plan', () => {
    const limits = getPlanLimits('growth');
    expect(limits.maxOrdersPerMonth).toBe(30000);
    expect(limits.maxWarehouses).toBe(3);
  });

  it('returns Infinity limits for enterprise plan', () => {
    const limits = getPlanLimits('enterprise');
    expect(limits.maxOrdersPerMonth).toBe(Infinity);
    expect(limits.maxUsers).toBe(Infinity);
    expect(limits.maxWarehouses).toBe(Infinity);
  });
});

describe('isWithinPlanLimit', () => {
  it('returns true when current is below limit', () => {
    expect(isWithinPlanLimit(50, 100)).toBe(true);
  });

  it('returns false when current equals limit', () => {
    expect(isWithinPlanLimit(100, 100)).toBe(false);
  });

  it('returns false when current exceeds limit', () => {
    expect(isWithinPlanLimit(101, 100)).toBe(false);
  });

  it('always returns true for Infinity limit', () => {
    expect(isWithinPlanLimit(999999, Infinity)).toBe(true);
  });
});

describe('calcUsagePercent', () => {
  it('returns 0 for Infinity limit', () => {
    expect(calcUsagePercent(500, Infinity)).toBe(0);
  });

  it('returns 0 for zero limit', () => {
    expect(calcUsagePercent(10, 0)).toBe(0);
  });

  it('calculates percentage correctly', () => {
    expect(calcUsagePercent(50, 100)).toBe(50);
    expect(calcUsagePercent(1, 4)).toBe(25);
  });

  it('caps at 100 when over limit', () => {
    expect(calcUsagePercent(200, 100)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(calcUsagePercent(1, 3)).toBe(33);
  });
});

describe('getUpgradeRecommendation', () => {
  it('returns null when usage is below 80%', () => {
    expect(getUpgradeRecommendation('free', 79)).toBeNull();
  });

  it('recommends next plan when usage is at 80%', () => {
    expect(getUpgradeRecommendation('free', 80)).toBe('starter');
    expect(getUpgradeRecommendation('starter', 80)).toBe('growth');
    expect(getUpgradeRecommendation('growth', 80)).toBe('enterprise');
  });

  it('returns null for enterprise (no higher plan)', () => {
    expect(getUpgradeRecommendation('enterprise', 100)).toBeNull();
  });

  it('recommends on usage above 80%', () => {
    expect(getUpgradeRecommendation('free', 99)).toBe('starter');
  });
});
