// ロケーションコード解析・生成ユーティリティ
// フォーマット: {ZONE}-{AISLE}-{BAY}-{LEVEL}
// 例: A-01-02-3

export interface ParsedLocation {
  zone: string;   // 例: 'A'
  aisle: string;  // 例: '01'
  bay: string;    // 例: '02'
  level: string;  // 例: '3'
}

const LOCATION_PATTERN = /^([A-Z]+)-(\d{2})-(\d{2})-(\d+)$/;

export function parseLocationCode(code: string): ParsedLocation | null {
  if (!code) return null;
  const match = code.match(LOCATION_PATTERN);
  if (!match) return null;
  return {
    zone: match[1],
    aisle: match[2],
    bay: match[3],
    level: match[4],
  };
}

export function isValidLocationCode(code: string): boolean {
  return LOCATION_PATTERN.test(code);
}

export function buildLocationCode(parsed: ParsedLocation): string {
  return `${parsed.zone}-${parsed.aisle.padStart(2, '0')}-${parsed.bay.padStart(2, '0')}-${parsed.level}`;
}

// ゾーン→通路→棚→段 の辞書順比較
export function compareLocationCodes(a: string, b: string): number {
  const pa = parseLocationCode(a);
  const pb = parseLocationCode(b);

  // 解析できないコードは末尾に
  if (!pa && !pb) return a.localeCompare(b);
  if (!pa) return 1;
  if (!pb) return -1;

  if (pa.zone !== pb.zone) return pa.zone.localeCompare(pb.zone);
  if (pa.aisle !== pb.aisle) return pa.aisle.localeCompare(pb.aisle);
  if (pa.bay !== pb.bay) return pa.bay.localeCompare(pb.bay);
  return pa.level.localeCompare(pb.level, undefined, { numeric: true });
}

// ロケーションが同一ゾーン内かを確認
export function isSameZone(codeA: string, codeB: string): boolean {
  const a = parseLocationCode(codeA);
  const b = parseLocationCode(codeB);
  if (!a || !b) return false;
  return a.zone === b.zone;
}

// 指定ゾーンのロケーション群を並び順でソート
export function sortLocationCodes(codes: string[]): string[] {
  return [...codes].sort(compareLocationCodes);
}
