import {
  validateLotNumber,
  validateSerialNumber,
  daysUntilExpiry,
  classifyLotStatus,
  isLotExpired,
} from '@/lib/utils/lot';

describe('validateLotNumber', () => {
  it('accepts alphanumeric with hyphens, dots, underscores', () => {
    expect(validateLotNumber('LOT-001')).toBe(true);
    expect(validateLotNumber('ABC123')).toBe(true);
    expect(validateLotNumber('lot_2026.01')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateLotNumber('')).toBe(false);
  });

  it('rejects strings over 100 characters', () => {
    expect(validateLotNumber('A'.repeat(101))).toBe(false);
    expect(validateLotNumber('A'.repeat(100))).toBe(true);
  });

  it('rejects strings with spaces or special chars', () => {
    expect(validateLotNumber('LOT 001')).toBe(false);
    expect(validateLotNumber('LOT@001')).toBe(false);
    expect(validateLotNumber('LOT#001')).toBe(false);
  });
});

describe('validateSerialNumber', () => {
  it('accepts valid serial numbers', () => {
    expect(validateSerialNumber('SN-20260101-001')).toBe(true);
    expect(validateSerialNumber('ABC123XYZ')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateSerialNumber('')).toBe(false);
  });

  it('rejects strings over 100 characters', () => {
    expect(validateSerialNumber('X'.repeat(101))).toBe(false);
  });
});

describe('daysUntilExpiry', () => {
  const ref = new Date('2026-06-25T00:00:00.000Z');

  it('returns positive number for future expiry', () => {
    const expiry = new Date('2026-07-25T00:00:00.000Z');
    expect(daysUntilExpiry(expiry, ref)).toBe(30);
  });

  it('returns negative number for past expiry', () => {
    const expiry = new Date('2026-06-24T00:00:00.000Z');
    expect(daysUntilExpiry(expiry, ref)).toBe(-1);
  });

  it('returns 0 for same-day expiry (rounds up from fractional)', () => {
    // 同日 0時: ms差=0, ceil(0) = 0
    const expiry = new Date('2026-06-25T00:00:00.000Z');
    expect(daysUntilExpiry(expiry, ref)).toBe(0);
  });
});

describe('classifyLotStatus', () => {
  const ref = new Date('2026-06-25T00:00:00.000Z');

  it('returns valid for null expiry', () => {
    expect(classifyLotStatus(null, 30, ref)).toBe('valid');
  });

  it('returns expired for past date', () => {
    const past = new Date('2026-06-01T00:00:00.000Z');
    expect(classifyLotStatus(past, 30, ref)).toBe('expired');
  });

  it('returns expiring_soon within warnDays', () => {
    const soon = new Date('2026-07-10T00:00:00.000Z');
    expect(classifyLotStatus(soon, 30, ref)).toBe('expiring_soon');
  });

  it('returns valid when expiry is beyond warnDays', () => {
    const far = new Date('2026-08-01T00:00:00.000Z');
    expect(classifyLotStatus(far, 30, ref)).toBe('valid');
  });

  it('applies custom warnDays', () => {
    const days15 = new Date('2026-07-10T00:00:00.000Z'); // 15 days away
    expect(classifyLotStatus(days15, 10, ref)).toBe('valid');
    expect(classifyLotStatus(days15, 20, ref)).toBe('expiring_soon');
  });
});

describe('isLotExpired', () => {
  const ref = new Date('2026-06-25T00:00:00.000Z');

  it('returns true for expired lot', () => {
    expect(isLotExpired(new Date('2026-06-20T00:00:00.000Z'), ref)).toBe(true);
  });

  it('returns false for valid lot', () => {
    expect(isLotExpired(new Date('2026-07-01T00:00:00.000Z'), ref)).toBe(false);
  });
});
