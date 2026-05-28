import { supabase } from '@/services/supabaseClient';
import { LoanRecord } from '@/types';

// ══════════════════════════════════════════════════
// Loans (Vay nợ)
// ══════════════════════════════════════════════════

export async function fetchLoans(): Promise<LoanRecord[]> {
  const { data, error } = await supabase
    .from('acc_loans')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data || []) as LoanRecord[];
}

export async function addLoan(
  loan: Omit<LoanRecord, 'id' | 'created_at'>
): Promise<LoanRecord> {
  const { data, error } = await supabase
    .from('acc_loans')
    .insert(loan)
    .select()
    .single();
  if (error) throw error;

  // CashFlow: tiền vào khi nhận vay
  await supabase.from('expense_expenses').insert({
    title: `Vay: ${loan.lender_name} ${loan.term_months}T`,
    amount: loan.principal,
    currency: loan.currency,
    expense_date: loan.start_date,
    category_id: null,
    project: '',
    client_name: '',
    vendor: loan.lender_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'revenue',
    source_type: 'loan',
    source_id: data.id,
    notes: `Nhận vay, lãi suất ${loan.interest_rate}%/năm, đáo hạn ${loan.due_date}`,
    receipt_url: '',
    created_by: loan.created_by,
  });

  return data as LoanRecord;
}

export async function recordLoanRepayment(
  id: string,
  amountPaid: number,
  loan: LoanRecord,
  currentUser: string
): Promise<LoanRecord> {
  const newOutstanding = Math.max(0, loan.outstanding - amountPaid);
  const newStatus = newOutstanding <= 0 ? 'paid_off' : 'active';

  const { data, error } = await supabase
    .from('acc_loans')
    .update({ outstanding: newOutstanding, status: newStatus })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // CashFlow: tiền ra khi trả nợ
  await supabase.from('expense_expenses').insert({
    title: `Trả nợ: ${loan.lender_name}`,
    amount: amountPaid,
    currency: loan.currency,
    expense_date: new Date().toISOString().slice(0, 10),
    category_id: null,
    project: '',
    client_name: '',
    vendor: loan.lender_name,
    payment_method: 'CK',
    status: 'paid',
    type: 'expense',
    source_type: 'loan',
    source_id: id,
    notes: `Trả nợ vay, dư nợ còn lại: ${newOutstanding.toLocaleString()}`,
    receipt_url: '',
    created_by: currentUser,
  });

  return data as LoanRecord;
}

export async function markLoanPaidOff(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_loans')
    .update({ status: 'paid_off', outstanding: 0 })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from('acc_loans').delete().eq('id', id);
  if (error) throw error;
}

// ── Helpers ───────────────────────────────────────

/** Tính ngày đáo hạn từ ngày bắt đầu + kỳ hạn tháng */
export function calcDueDate(startDate: string, termMonths: number): string {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + termMonths);
  return d.toISOString().slice(0, 10);
}
