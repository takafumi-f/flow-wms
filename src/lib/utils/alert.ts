export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'stock_discrepancy' | 'low_efficiency' | 'low_stock' | 'expiry';

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown>;
}

export function classifyDiscrepancySeverity(diffPct: number): AlertSeverity {
  if (diffPct >= 20) return 'critical';
  if (diffPct >= 5) return 'warning';
  return 'info';
}

export function detectStockDiscrepancy(
  systemQty: number,
  countedQty: number,
  thresholdPct = 5,
): Alert | null {
  if (systemQty === 0 && countedQty === 0) return null;
  const base = Math.max(systemQty, 1);
  const diffPct = (Math.abs(systemQty - countedQty) / base) * 100;
  if (diffPct < thresholdPct) return null;
  return {
    type: 'stock_discrepancy',
    severity: classifyDiscrepancySeverity(diffPct),
    message: `在庫差異 ${diffPct.toFixed(1)}%（システム: ${systemQty}, 実数: ${countedQty}）`,
    metadata: { systemQty, countedQty, diffPct },
  };
}

export function detectEfficiencyDrop(
  currentRate: number,
  baselineRate: number,
  thresholdPct = 20,
): Alert | null {
  if (baselineRate <= 0) return null;
  const dropPct = ((baselineRate - currentRate) / baselineRate) * 100;
  if (dropPct < thresholdPct) return null;
  return {
    type: 'low_efficiency',
    severity: dropPct >= 40 ? 'critical' : 'warning',
    message: `作業効率 ${dropPct.toFixed(1)}% 低下（現在: ${currentRate}/h, 基準: ${baselineRate}/h）`,
    metadata: { currentRate, baselineRate, dropPct },
  };
}

export function detectExpiryAlert(
  itemName: string,
  daysUntilExpiry: number,
  warnDays = 30,
): Alert | null {
  if (daysUntilExpiry > warnDays) return null;
  const severity: AlertSeverity = daysUntilExpiry < 0 ? 'critical' : 'warning';
  const label = daysUntilExpiry < 0 ? '期限切れ' : `あと ${daysUntilExpiry} 日`;
  return {
    type: 'expiry',
    severity,
    message: `${itemName}: 賞味期限 ${label}`,
    metadata: { itemName, daysUntilExpiry },
  };
}
