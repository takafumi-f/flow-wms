// バーコード処理ユーティリティ

export type BarcodeType = 'EAN13' | 'EAN8' | 'CODE128' | 'QR' | 'GS1_128' | 'UNKNOWN';

export interface ParsedBarcode {
  type: BarcodeType;
  value: string;
  isValid: boolean;
}

export interface GS1Data {
  itemCode?: string;   // AI 01
  lotNumber?: string;  // AI 10
  expiryDate?: Date;   // AI 17
  quantity?: number;   // AI 30
}

// バーコードタイプを判定
export function detectBarcodeType(barcode: string): BarcodeType {
  if (!barcode) return 'UNKNOWN';

  // GS1-128: FNC1 (ASCII 232) で始まるか、]C1 で始まる
  if (barcode.startsWith('è') || barcode.startsWith(']C1')) {
    return 'GS1_128';
  }

  // EAN-13: 数字13桁
  if (/^\d{13}$/.test(barcode)) return 'EAN13';

  // EAN-8: 数字8桁
  if (/^\d{8}$/.test(barcode)) return 'EAN8';

  // CODE128: 英数字・記号を含む
  if (/^[\x20-\x7E]+$/.test(barcode) && barcode.length >= 2) return 'CODE128';

  return 'UNKNOWN';
}

// EAN-13 チェックデジット検証
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(barcode[12], 10);
}

// EAN-8 チェックデジット検証
export function validateEAN8(barcode: string): boolean {
  if (!/^\d{8}$/.test(barcode)) return false;

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(barcode[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(barcode[7], 10);
}

// GS1-128 から各データを抽出
// AI (Application Identifier) ベースの解析
export function parseGS1(barcode: string): GS1Data {
  // FNC1 プレフィックスを除去
  let data = barcode.replace(/^è|\]C1/, '');
  const result: GS1Data = {};

  // 固定長AIの定義: [AI, データ長]
  const fixedLengthAIs: Record<string, number> = {
    '01': 14, // GTIN
    '11': 6,  // 製造日 YYMMDD
    '13': 6,  // 包装日
    '15': 6,  // 賞味期限 YYMMDD
    '17': 6,  // 使用期限 YYMMDD
    '20': 2,  // 内部用AI
    '30': 8,  // 数量
  };

  while (data.length > 0) {
    let matched = false;

    // 固定長AI を試す（2〜4桁）
    for (const len of [4, 3, 2]) {
      if (data.length < len) continue;
      const ai = data.slice(0, len);
      const dataLen = fixedLengthAIs[ai];
      if (dataLen !== undefined) {
        const value = data.slice(len, len + dataLen);
        data = data.slice(len + dataLen);

        if (ai === '01' && value.length >= 13) {
          result.itemCode = value.slice(1); // GTIN-13
        } else if (ai === '17' || ai === '15') {
          // 賞味期限: YYMMDD
          result.expiryDate = parseGS1Date(value);
        } else if (ai === '30') {
          result.quantity = parseInt(value.trimStart(), 10) || undefined;
        }
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // 可変長AI: AI 10 (ロット番号)、AI 21 (シリアル番号) など
    if (data.startsWith('10')) {
      const gs1Separator = '';
      const sepIdx = data.indexOf(gs1Separator);
      const end = sepIdx === -1 ? data.length : sepIdx;
      result.lotNumber = data.slice(2, end);
      data = sepIdx === -1 ? '' : data.slice(end + 1);
      continue;
    }

    // 解析できない場合はスキップ
    break;
  }

  return result;
}

// YYMMDD → Date 変換（2000年代以降を仮定）
function parseGS1Date(yymmdd: string): Date | undefined {
  if (yymmdd.length !== 6) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10) - 1;
  const dd = parseInt(yymmdd.slice(4, 6), 10);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  const d = new Date(year, mm, dd);
  return isNaN(d.getTime()) ? undefined : d;
}

// バーコードを解析して全情報を返す
export function parseBarcode(barcode: string): ParsedBarcode {
  const type = detectBarcodeType(barcode);

  let isValid = false;
  switch (type) {
    case 'EAN13':
      isValid = validateEAN13(barcode);
      break;
    case 'EAN8':
      isValid = validateEAN8(barcode);
      break;
    case 'CODE128':
    case 'GS1_128':
    case 'QR':
      isValid = barcode.length > 0;
      break;
    default:
      isValid = false;
  }

  return { type, value: barcode, isValid };
}
