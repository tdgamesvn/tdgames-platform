import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { fetchExchangeRate, ExchangeRateData, avgRate } from './exchangeRateService';
import { upsertFxRate } from '@/apps/expense/services/fxRateService';

interface ExchangeRateContextValue {
  rate: ExchangeRateData | null;
  loading: boolean;
  /** (buy + sell) / 2 — fallback to 25400 if rate not yet loaded */
  avgUsdVnd: number;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ExchangeRateContextValue | null>(null);

const REFRESH_MS = 60 * 60 * 1000; // 1 hour

export const ExchangeRateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rate, setRate] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExchangeRate();
      setRate(data);
      // Auto-save today's VCB avg rate to DB for historical reporting
      const today = new Date().toISOString().split('T')[0];
      const avg = avgRate(data);
      if (avg > 0) {
        upsertFxRate({
          rate_date: today,
          from_currency: 'USD',
          to_currency: 'VND',
          rate: avg,
          source: 'vcb',
        }).catch(() => {}); // fire-and-forget, không block UI
      }
    } catch (err) {
      console.warn('[ExchangeRate] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const avgUsdVnd = rate && rate.buy > 0 && rate.sell > 0 ? avgRate(rate) : 25400;

  return (
    <Ctx.Provider value={{ rate, loading, avgUsdVnd, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export function useExchangeRate(): ExchangeRateContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useExchangeRate must be used within <ExchangeRateProvider>');
  }
  return ctx;
}
