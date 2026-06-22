import { supabase } from '@/services/supabaseClient';

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  swift_code?: string;
  citad_code?: string;
  bank_address?: string;
  currency: string;
  account_type: 'company' | 'personal';
  entity: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân';
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('finance_bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}
