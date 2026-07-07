import { supabase } from './supabaseClient';

export interface BankBalanceSnapshot {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: 'manual' | 'statement_reconciled';
  recorded_by: string | null;
  created_at: string;
}

/** Most recent snapshot per account (one row per account_id). */
export async function fetchLatestBalances(): Promise<BankBalanceSnapshot[]> {
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const latest = new Map<string, BankBalanceSnapshot>();
  for (const row of (data || []) as BankBalanceSnapshot[]) {
    if (!latest.has(row.account_id)) latest.set(row.account_id, row);
  }
  return Array.from(latest.values());
}

export async function fetchBalanceHistory(accountId: string, days = 90): Promise<BankBalanceSnapshot[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('*')
    .eq('account_id', accountId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  return (data || []) as BankBalanceSnapshot[];
}

export async function addBalanceSnapshot(input: {
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: 'manual' | 'statement_reconciled';
  recorded_by: string;
}): Promise<void> {
  const { error } = await supabase.from('finance_bank_balance_snapshots').insert(input);
  if (error) throw error;
}
