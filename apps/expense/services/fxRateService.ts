import { supabase } from '@/services/supabaseClient';

export interface FxRate {
  id?: string;
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: 'manual' | 'vcb' | string;
  created_at?: string;
  updated_at?: string;
}

// ── CRUD ─────────────────────────────────────────────────────
export async function fetchFxRates(year?: number): Promise<FxRate[]> {
  let q = supabase
    .from('finance_fx_rates')
    .select('*')
    .order('rate_date', { ascending: false });
  if (year) {
    q = q.gte('rate_date', `${year}-01-01`).lte('rate_date', `${year}-12-31`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertFxRate(rate: Omit<FxRate, 'id' | 'created_at' | 'updated_at'>): Promise<FxRate> {
  const { data, error } = await supabase
    .from('finance_fx_rates')
    .upsert(
      { ...rate, updated_at: new Date().toISOString() },
      { onConflict: 'rate_date,from_currency,to_currency' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFxRate(id: string): Promise<void> {
  const { error } = await supabase.from('finance_fx_rates').delete().eq('id', id);
  if (error) throw error;
}

// ── Lookup: get rate for a specific date (closest past date) ──
export async function getRateForDate(
  fromCurrency: string,
  toCurrency: string,
  date: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;
  const { data } = await supabase
    .from('finance_fx_rates')
    .select('rate')
    .eq('from_currency', fromCurrency)
    .eq('to_currency', toCurrency)
    .lte('rate_date', date)
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.rate ?? null;
}

// ── Convert amount using nearest available rate ───────────────
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: FxRate[]
): number | null {
  if (from === to) return amount;
  // Find closest past rate
  const match = rates
    .filter(r => r.from_currency === from && r.to_currency === to)
    .sort((a, b) => b.rate_date.localeCompare(a.rate_date))[0];
  if (!match) return null;
  return amount * match.rate;
}

// ── Get latest rate for display ───────────────────────────────
export function getLatestRate(
  from: string,
  to: string,
  rates: FxRate[]
): FxRate | null {
  return rates
    .filter(r => r.from_currency === from && r.to_currency === to)
    .sort((a, b) => b.rate_date.localeCompare(a.rate_date))[0] ?? null;
}
