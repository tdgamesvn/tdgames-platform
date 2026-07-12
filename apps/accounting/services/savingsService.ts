import { getWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';
import { SavingsDeposit } from '@/types';

// ══════════════════════════════════════════════════
// Savings Deposits (Gửi tiết kiệm)
// ══════════════════════════════════════════════════

export async function fetchSavings(): Promise<SavingsDeposit[]> {
  const { data, error } = await supabase
    .from('acc_savings')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data || []) as SavingsDeposit[];
}

export async function addSaving(
  saving: Omit<SavingsDeposit, 'id' | 'created_at'>
): Promise<SavingsDeposit> {
  const { data, error } = await supabase
    .from('acc_savings')
    .insert({ entity: getWorkspace(), ...saving })
    .select()
    .single();
  if (error) throw error;

  // CashFlow: tiền ra khi gửi tiết kiệm
  await supabase.from('expense_expenses').insert({
    entity: getWorkspace(), // dòng tiền theo sổ của khoản tiết kiệm
    title: `Gửi TK: ${saving.bank_name} ${saving.term_months}T`,
    amount: saving.principal,
    currency: saving.currency,
    expense_date: saving.start_date,
    category_id: null,
    project: '',
    client_name: '',
    vendor: saving.bank_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'expense',
    source_type: 'savings',
    source_id: data.id,
    notes: `Gửi tiết kiệm ${saving.term_months} tháng, lãi suất ${saving.interest_rate}%/năm`,
    receipt_url: '',
    created_by: saving.created_by,
  });

  return data as SavingsDeposit;
}

export async function settleSaving(
  id: string,
  interestEarned: number,
  currentUser: string,
  saving: SavingsDeposit
): Promise<void> {
  const { error } = await supabase
    .from('acc_savings')
    .update({ status: 'withdrawn', interest_earned: interestEarned })
    .eq('id', id);
  if (error) throw error;

  // CashFlow: tiền về (gốc + lãi)
  const totalReceived = saving.principal + interestEarned;
  await supabase.from('expense_expenses').insert({
    entity: getWorkspace(), // dòng tiền theo sổ của khoản tiết kiệm
    title: `Tất toán TK: ${saving.bank_name} ${saving.term_months}T`,
    amount: totalReceived,
    currency: saving.currency,
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: null,
    project: '',
    client_name: '',
    vendor: saving.bank_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'revenue',
    source_type: 'savings',
    source_id: id,
    notes: `Gốc: ${saving.principal.toLocaleString()}, Lãi thực nhận: ${interestEarned.toLocaleString()}`,
    receipt_url: '',
    created_by: currentUser,
  });
}

export async function renewSaving(
  oldId: string,
  newData: Omit<SavingsDeposit, 'id' | 'created_at'>,
  currentUser: string,
  oldSaving: SavingsDeposit
): Promise<SavingsDeposit> {
  // Đánh dấu cũ là đã tái tục
  const { error: updateError } = await supabase
    .from('acc_savings')
    .update({ status: 'renewed' })
    .eq('id', oldId);
  if (updateError) throw updateError;

  // Tạo bản ghi mới với parent_id
  const { data, error } = await supabase
    .from('acc_savings')
    .insert({ entity: getWorkspace(), ...newData, parent_id: oldId })
    .select()
    .single();
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);

  // CashFlow: tiền về từ khoản cũ
  await supabase.from('expense_expenses').insert({
    entity: getWorkspace(), // dòng tiền theo sổ của khoản tiết kiệm
    title: `Tất toán TK (tái tục): ${oldSaving.bank_name} ${oldSaving.term_months}T`,
    amount: oldSaving.principal,
    currency: oldSaving.currency,
    expense_date: today,
    category_id: null,
    project: '',
    client_name: '',
    vendor: oldSaving.bank_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'revenue',
    source_type: 'savings',
    source_id: oldId,
    notes: `Tái tục tiết kiệm sang kỳ mới ${newData.term_months}T`,
    receipt_url: '',
    created_by: currentUser,
  });

  // CashFlow: tiền ra cho khoản mới
  await supabase.from('expense_expenses').insert({
    entity: getWorkspace(), // dòng tiền theo sổ của khoản tiết kiệm
    title: `Gửi TK (tái tục): ${newData.bank_name} ${newData.term_months}T`,
    amount: newData.principal,
    currency: newData.currency,
    expense_date: newData.start_date,
    category_id: null,
    project: '',
    client_name: '',
    vendor: newData.bank_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'expense',
    source_type: 'savings',
    source_id: data.id,
    notes: `Tái tục từ khoản trước, lãi suất ${newData.interest_rate}%/năm`,
    receipt_url: '',
    created_by: currentUser,
  });

  return data as SavingsDeposit;
}

export async function deleteSaving(id: string): Promise<void> {
  const { error } = await supabase.from('acc_savings').delete().eq('id', id);
  if (error) throw error;
}

// ── Helpers ───────────────────────────────────────

/** Tính ngày đáo hạn từ ngày bắt đầu + kỳ hạn tháng */
export function calcMaturityDate(startDate: string, termMonths: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + termMonths);
  return d.toISOString().slice(0, 10);
}

/** Số ngày còn lại đến đáo hạn (âm = đã quá hạn) */
export function daysUntilMaturity(maturityDate: string): number {
  const maturity = new Date(maturityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((maturity.getTime() - today.getTime()) / 86400000);
}
