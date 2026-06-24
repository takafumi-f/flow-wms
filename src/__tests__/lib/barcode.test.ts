import {
  detectBarcodeType,
  validateEAN13,
  validateEAN8,
  parseGS1,
  parseBarcode,
} from '@/lib/utils/barcode';

describe('detectBarcodeType', () => {
  it('detects EAN-13 (13 digits)', () => {
    expect(detectBarcodeType('4901234567890')).toBe('EAN13');
  });

  it('detects EAN-8 (8 digits)', () => {
    expect(detectBarcodeType('96385074')).toBe('EAN8');
  });

  it('detects CODE128 (alphanumeric)', () => {
    expect(detectBarcodeType('ABC-12345')).toBe('CODE128');
    expect(detectBarcodeType('LOT001')).toBe('CODE128');
  });

  it('detects GS1-128 by prefix', () => {
    expect(detectBarcodeType(']C1011234567890128')).toBe('GS1_128');
  });

  it('returns UNKNOWN for empty string', () => {
    expect(detectBarcodeType('')).toBe('UNKNOWN');
  });
});

describe('validateEAN13', () => {
  // 日本のJANコード（EAN-13の一種）のテスト
  it('validates correct EAN-13 (4901234567894)', () => {
    // sum(490123456789): 4+27+0+3+2+9+4+15+6+21+8+27 = 126 → check = (10-6)%10 = 4
    expect(validateEAN13('4901234567894')).toBe(true);
  });

  it('rejects EAN-13 with wrong check digit', () => {
    expect(validateEAN13('4901234567891')).toBe(false);
  });

  it('rejects non-13-digit strings', () => {
    expect(validateEAN13('123456789012')).toBe(false);  // 12 digits
    expect(validateEAN13('12345678901234')).toBe(false); // 14 digits
    expect(validateEAN13('490123456789A')).toBe(false);  // non-digit
  });

  it('validates multiple valid codes', () => {
    // These are algorithmically valid EAN-13 codes
    const validCode = '0000000000000'; // All zeros has check digit 0
    expect(validateEAN13(validCode)).toBe(true);
  });
});

describe('validateEAN8', () => {
  it('validates correct EAN-8', () => {
    // 0000000: sum = 0, check = 0
    expect(validateEAN8('00000000')).toBe(true);
  });

  it('rejects EAN-8 with wrong check digit', () => {
    expect(validateEAN8('96385071')).toBe(false);
  });

  it('rejects non-8-digit strings', () => {
    expect(validateEAN8('1234567')).toBe(false);
    expect(validateEAN8('123456789')).toBe(false);
  });
});

describe('parseGS1', () => {
  it('extracts lot number from GS1-128 with AI 10', () => {
    // AI 10 = ロット番号
    const barcode = '10LOT-ABC-123';
    const result = parseGS1(barcode);
    expect(result.lotNumber).toBe('LOT-ABC-123');
  });

  it('extracts expiry date with AI 17', () => {
    // AI 17 = 使用期限 YYMMDD: 260630 = 2026-06-30
    const barcode = '17260630';
    const result = parseGS1(barcode);
    expect(result.expiryDate).toBeInstanceOf(Date);
    expect(result.expiryDate?.getFullYear()).toBe(2026);
    expect(result.expiryDate?.getMonth()).toBe(5); // 0-indexed
    expect(result.expiryDate?.getDate()).toBe(30);
  });

  it('returns empty object for unrecognized barcode', () => {
    const result = parseGS1('XXXXXXXX');
    expect(result.itemCode).toBeUndefined();
    expect(result.lotNumber).toBeUndefined();
    expect(result.expiryDate).toBeUndefined();
  });
});

describe('parseBarcode', () => {
  it('returns EAN13 type with valid=true for valid EAN-13', () => {
    const result = parseBarcode('4901234567894');
    expect(result.type).toBe('EAN13');
    expect(result.isValid).toBe(true);
    expect(result.value).toBe('4901234567894');
  });

  it('returns EAN13 type with valid=false for invalid check digit', () => {
    const result = parseBarcode('4901234567891');
    expect(result.type).toBe('EAN13');
    expect(result.isValid).toBe(false);
  });

  it('returns CODE128 type with valid=true for alphanumeric', () => {
    const result = parseBarcode('SHP-001-2026');
    expect(result.type).toBe('CODE128');
    expect(result.isValid).toBe(true);
  });

  it('returns UNKNOWN for empty string with valid=false', () => {
    const result = parseBarcode('');
    expect(result.type).toBe('UNKNOWN');
    expect(result.isValid).toBe(false);
  });
});
