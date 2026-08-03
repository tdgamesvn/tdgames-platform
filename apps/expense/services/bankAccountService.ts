import { supabase } from '@/services/supabaseClient';
import { BankingInfo } from '@/types';

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  account_name?: string;   // chủ TK (beneficiary) — in trên hoá đơn
  branch_name?: string;    // chi nhánh — in trên hoá đơn
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

/**
 * Snapshot TK ngân hàng để in lên hoá đơn (preview/PDF/email).
 * Snapshot chứ không join: hoá đơn đã phát hành phải giữ nguyên thông tin TK tại thời điểm
 * phát hành, kể cả sau này TK bị sửa hoặc ẩn đi.
 */
export function toBankingInfo(acc: BankAccount): BankingInfo {
  return {
    alias: acc.name || '',
    accountName: acc.account_name || acc.name || '',
    accountNumber: acc.account_number || '',
    bankName: acc.bank_name || '',
    branchName: acc.branch_name || '',
    bankAddress: acc.bank_address || '',
    citadCode: acc.citad_code || '',
    swiftCode: acc.swift_code || '',
  };
}
