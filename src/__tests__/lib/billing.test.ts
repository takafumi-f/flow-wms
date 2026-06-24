import {
  calcStorageFee,
  calcHandlingFee,
  calcMonthlyBilling,
  daysInMonth,
} from '@/lib/utils/billing';

describe('calcStorageFee', () => {
  it('calculates fee correctly', () => {
    expect(calcStorageFee(10, 10, 30)).toBe(3000);
  });

  it('returns 0 for zero locations', () => {
    expect(calcStorageFee(0, 10, 30)).toBe(0);
  });

  it('returns 0 for negative inputs', () => {
    expect(calcStorageFee(-1, 10, 30)).toBe(0);
    expect(calcStorageFee(10, -1, 30)).toBe(0);
    expect(calcStorageFee(10, 10, -1)).toBe(0);
  });

  it('rounds up fractional result', () => {
    // 3 * 3.33 * 1 = 9.99 → ceil → 10
    expect(calcStorageFee(3, 3.33, 1)).toBe(10);
  });
});

describe('calcHandlingFee', () => {
  it('calculates fee correctly', () => {
    expect(calcHandlingFee(100, 50)).toBe(5000);
  });

  it('returns 0 for zero lines', () => {
    expect(calcHandlingFee(0, 50)).toBe(0);
  });

  it('returns 0 for negative inputs', () => {
    expect(calcHandlingFee(-1, 50)).toBe(0);
    expect(calcHandlingFee(10, -1)).toBe(0);
  });

  it('rounds up fractional result', () => {
    expect(calcHandlingFee(1, 1.5)).toBe(2);
  });
});

describe('calcMonthlyBilling', () => {
  const base = {
    storageDays: 30,
    locationCount: 100,
    storageFeePerLocationPerDay: 10,
    inboundLines: 200,
    outboundLines: 300,
    inboundFeePerLine: 50,
    outboundFeePerLine: 80,
  };

  it('sums all fee components correctly', () => {
    const result = calcMonthlyBilling(base);
    expect(result.storageFee).toBe(30000);   // 100 * 10 * 30
    expect(result.inboundFee).toBe(10000);   // 200 * 50
    expect(result.outboundFee).toBe(24000);  // 300 * 80
    expect(result.total).toBe(64000);
  });

  it('total equals sum of components', () => {
    const result = calcMonthlyBilling(base);
    expect(result.total).toBe(result.storageFee + result.inboundFee + result.outboundFee);
  });

  it('returns zeros for empty billing input', () => {
    const result = calcMonthlyBilling({
      storageDays: 0, locationCount: 0, storageFeePerLocationPerDay: 0,
      inboundLines: 0, outboundLines: 0, inboundFeePerLine: 0, outboundFeePerLine: 0,
    });
    expect(result.total).toBe(0);
  });
});

describe('daysInMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it('returns 28 for February in non-leap year', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('returns 29 for February in leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('returns 31 for December', () => {
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});
