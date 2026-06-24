'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { KpiData } from '@/types';

const DEFAULT_INTERVAL_MS = 30_000;

export interface UseKpiPollingResult {
  data: KpiData | null;
  loading: boolean;
  lastUpdatedAt: Date | null;
  refresh: () => void;
}

export function useKpiPolling(intervalMs = DEFAULT_INTERVAL_MS): UseKpiPollingResult {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchKpi = useCallback(async () => {
    try {
      const res = await globalThis.fetch('/api/kpi');
      if (!res.ok) return;
      const json: KpiData = await res.json();
      setData(json);
      setLastUpdatedAt(new Date());
    } catch {
      // silent fail — retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKpi();
    timerRef.current = setInterval(fetchKpi, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchKpi, intervalMs]);

  return { data, loading, lastUpdatedAt, refresh: fetchKpi };
}
