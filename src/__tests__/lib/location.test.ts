import {
  parseLocationCode,
  isValidLocationCode,
  buildLocationCode,
  compareLocationCodes,
  isSameZone,
  sortLocationCodes,
} from '@/lib/utils/location';

describe('parseLocationCode', () => {
  it('parses valid location code A-01-02-3', () => {
    const result = parseLocationCode('A-01-02-3');
    expect(result).toEqual({ zone: 'A', aisle: '01', bay: '02', level: '3' });
  });

  it('parses multi-character zone', () => {
    const result = parseLocationCode('AB-01-01-1');
    expect(result).toEqual({ zone: 'AB', aisle: '01', bay: '01', level: '1' });
  });

  it('returns null for invalid format', () => {
    expect(parseLocationCode('invalid')).toBeNull();
    expect(parseLocationCode('A-1-2-3')).toBeNull();    // aisle must be 2 digits
    expect(parseLocationCode('A-01-2-3')).toBeNull();   // bay must be 2 digits
    expect(parseLocationCode('')).toBeNull();
  });

  it('returns null for lowercase zone', () => {
    expect(parseLocationCode('a-01-01-1')).toBeNull();
  });

  it('handles multi-digit level', () => {
    const result = parseLocationCode('A-01-01-10');
    expect(result?.level).toBe('10');
  });
});

describe('isValidLocationCode', () => {
  it('validates correct format', () => {
    expect(isValidLocationCode('A-01-01-1')).toBe(true);
    expect(isValidLocationCode('Z-99-99-9')).toBe(true);
    expect(isValidLocationCode('BC-01-02-3')).toBe(true);
  });

  it('rejects incorrect format', () => {
    expect(isValidLocationCode('1-01-01-1')).toBe(false);   // zone must be letters
    expect(isValidLocationCode('A-1-01-1')).toBe(false);    // aisle must be 2 digits
    expect(isValidLocationCode('A-01-01')).toBe(false);     // missing level
    expect(isValidLocationCode('')).toBe(false);
    expect(isValidLocationCode('RECV-001')).toBe(false);
  });
});

describe('buildLocationCode', () => {
  it('builds correct location code', () => {
    expect(buildLocationCode({ zone: 'A', aisle: '01', bay: '02', level: '3' })).toBe('A-01-02-3');
  });

  it('pads aisle and bay to 2 digits', () => {
    expect(buildLocationCode({ zone: 'B', aisle: '5', bay: '3', level: '1' })).toBe('B-05-03-1');
  });
});

describe('compareLocationCodes', () => {
  it('sorts by zone first', () => {
    expect(compareLocationCodes('B-01-01-1', 'A-01-01-1')).toBeGreaterThan(0);
    expect(compareLocationCodes('A-01-01-1', 'B-01-01-1')).toBeLessThan(0);
  });

  it('sorts by aisle within same zone', () => {
    expect(compareLocationCodes('A-02-01-1', 'A-01-01-1')).toBeGreaterThan(0);
    expect(compareLocationCodes('A-01-01-1', 'A-02-01-1')).toBeLessThan(0);
  });

  it('sorts by bay within same zone and aisle', () => {
    expect(compareLocationCodes('A-01-02-1', 'A-01-01-1')).toBeGreaterThan(0);
  });

  it('sorts by level within same zone, aisle, and bay', () => {
    expect(compareLocationCodes('A-01-01-2', 'A-01-01-1')).toBeGreaterThan(0);
  });

  it('returns 0 for identical codes', () => {
    expect(compareLocationCodes('A-01-01-1', 'A-01-01-1')).toBe(0);
  });

  it('places invalid codes at the end', () => {
    expect(compareLocationCodes('RECV-001', 'A-01-01-1')).toBeGreaterThan(0);
    expect(compareLocationCodes('A-01-01-1', 'RECV-001')).toBeLessThan(0);
  });
});

describe('isSameZone', () => {
  it('returns true for same zone', () => {
    expect(isSameZone('A-01-01-1', 'A-02-03-2')).toBe(true);
  });

  it('returns false for different zones', () => {
    expect(isSameZone('A-01-01-1', 'B-01-01-1')).toBe(false);
  });

  it('returns false for invalid codes', () => {
    expect(isSameZone('RECV-001', 'A-01-01-1')).toBe(false);
  });
});

describe('sortLocationCodes', () => {
  it('sorts codes in correct warehouse order', () => {
    const codes = ['C-01-01-1', 'A-03-01-1', 'A-01-02-1', 'B-01-01-1', 'A-01-01-2', 'A-01-01-1'];
    const sorted = sortLocationCodes(codes);
    expect(sorted).toEqual([
      'A-01-01-1',
      'A-01-01-2',
      'A-01-02-1',
      'A-03-01-1',
      'B-01-01-1',
      'C-01-01-1',
    ]);
  });

  it('does not mutate original array', () => {
    const original = ['B-01-01-1', 'A-01-01-1'];
    sortLocationCodes(original);
    expect(original[0]).toBe('B-01-01-1');
  });
});
