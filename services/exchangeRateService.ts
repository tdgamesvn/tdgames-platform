/**
 * Exchange Rate Service — fetches live USD/VND rate from Vietcombank
 * via Edge Function proxy.
 */

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vcb-exchange-rate`;

export interface ExchangeRateData {
  currency: string;
  buy: number;
  transfer: number;
  sell: number;
  updated_at: string;
  source: string;
}

export async function fetchExchangeRate(): Promise<ExchangeRateData> {
  const res = await fetch(EDGE_FN_URL);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Avg exchange rate = (buy + sell) / 2 — used for USD→VND conversions. */
export function avgRate(data: ExchangeRateData): number {
  return Math.round((data.buy + data.sell) / 2);
}
