export type LotStatus = 'valid' | 'expiring_soon' | 'expired';

const LOT_SERIAL_PATTERN = /^[A-Za-z0-9\-_.]+$/;

export function validateLotNumber(lot: string): boolean {
  return lot.length > 0 && lot.length <= 100 && LOT_SERIAL_PATTERN.test(lot);
}

export function validateSerialNumber(serial: string): boolean {
  return serial.length > 0 && serial.length <= 100 && LOT_SERIAL_PATTERN.test(serial);
}

export function daysUntilExpiry(expiryDate: Date, referenceDate: Date = new Date()): number {
  const ms = expiryDate.getTime() - referenceDate.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function classifyLotStatus(
  expiryDate: Date | null,
  warnDays = 30,
  referenceDate: Date = new Date(),
): LotStatus {
  if (!expiryDate) return 'valid';
  const days = daysUntilExpiry(expiryDate, referenceDate);
  if (days < 0) return 'expired';
  if (days <= warnDays) return 'expiring_soon';
  return 'valid';
}

export function isLotExpired(expiryDate: Date, referenceDate: Date = new Date()): boolean {
  return daysUntilExpiry(expiryDate, referenceDate) < 0;
}
