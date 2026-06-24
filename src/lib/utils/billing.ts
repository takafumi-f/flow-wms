export interface BillingInput {
  storageDays: number;
  locationCount: number;
  storageFeePerLocationPerDay: number;
  inboundLines: number;
  outboundLines: number;
  inboundFeePerLine: number;
  outboundFeePerLine: number;
}

export interface BillingResult {
  storageFee: number;
  inboundFee: number;
  outboundFee: number;
  total: number;
}

export function calcStorageFee(
  locationCount: number,
  pricePerDay: number,
  days: number,
): number {
  if (locationCount < 0 || pricePerDay < 0 || days < 0) return 0;
  return Math.ceil(locationCount * pricePerDay * days);
}

export function calcHandlingFee(lines: number, pricePerLine: number): number {
  if (lines < 0 || pricePerLine < 0) return 0;
  return Math.ceil(lines * pricePerLine);
}

export function calcMonthlyBilling(input: BillingInput): BillingResult {
  const storageFee = calcStorageFee(
    input.locationCount,
    input.storageFeePerLocationPerDay,
    input.storageDays,
  );
  const inboundFee = calcHandlingFee(input.inboundLines, input.inboundFeePerLine);
  const outboundFee = calcHandlingFee(input.outboundLines, input.outboundFeePerLine);
  return { storageFee, inboundFee, outboundFee, total: storageFee + inboundFee + outboundFee };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
