/**
 * Exchange Rate Service — fetches live USD/VND rate from **Techcombank**
 * (ngân hàng công ty nhận USD) via Edge Function proxy.
 * Slug `vcb-exchange-rate` là tên lịch sử, KHÔNG phải Vietcombank.
 * `buy`/`sell` = giá MUA/BÁN CHUYỂN KHOẢN (không phải tiền mặt).
 * Tỷ giá ghi HĐ dịch vụ = (mua CK + bán CK)/2 của NH thường giao dịch (TT 99/2025).
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

/** Avg exchange rate = (mua CK + bán CK) / 2 — used for USD→VND conversions. */
export function avgRate(data: ExchangeRateData): number {
  return Math.round((data.buy + data.sell) / 2);
}
