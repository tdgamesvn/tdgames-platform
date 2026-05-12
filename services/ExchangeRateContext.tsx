import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { fetchExchangeRate, ExchangeRateData, avgRate } from './exchangeRateService';

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
