import { getWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';
import { FixedAsset, Advance } from '@/types';

// ══════════════════════════════════════════════════
// Fixed Assets
// ══════════════════════════════════════════════════

export async function fetchFixedAssets(): Promise<FixedAsset[]> {
  const { data, error } = await supabase
    .from('acc_fixed_assets')
    .select('*')
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveFixedAsset(
  asset: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>
): Promise<FixedAsset> {
  const { data, error } = await supabase
    .from('acc_fixed_assets')
    .insert({ entity: getWorkspace(), ...asset })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFixedAsset(
  id: string,
  updates: Partial<Omit<FixedAsset, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('acc_fixed_assets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;

export async function uploadAssetDocumentToR2(
  file: File,
): Promise<{ url: string; fileName: string }> {
  if (file.size > 20 * 1024 * 1024) throw new Error('File quá lớn! Tối đa 20MB.');
  const { data: { session } } = await supabase.auth.getSession();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(R2_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session?.access_token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload thất bại');
  return { url: data.url, fileName: file.name };
}

export async function deleteFixedAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_fixed_assets')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Depreciation helpers ──────────────────────────

/** Tính khấu hao theo đường thẳng — trả về các chỉ số tại thời điểm hiện tại */
export function calcDepreciation(asset: FixedAsset, atDate: Date = new Date()) {
  const purchaseDate = new Date(asset.purchase_date);
  const depreciableAmount = asset.cost - asset.residual_value;
  const monthlyDep = depreciableAmount / asset.useful_life_months;

  // Số tháng đã sử dụng (tính từ đầu tháng mua)
  const monthsElapsed = Math.max(
    0,
    (atDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
      (atDate.getMonth() - purchaseDate.getMonth())
  );
  const depMonths = Math.min(monthsElapsed, asset.useful_life_months);
  const accumulated = monthlyDep * depMonths;
  const bookValue = Math.max(asset.residual_value, asset.cost - accumulated);
  const remainingMonths = Math.max(0, asset.useful_life_months - depMonths);
  const endDate = new Date(purchaseDate);
  endDate.setMonth(endDate.getMonth() + asset.useful_life_months);

  return {
    monthlyDep,
    yearlyDep: monthlyDep * 12,
    accumulated,
    bookValue,
    depMonths,
    remainingMonths,
    endDate,
    isFullyDepreciated: depMonths >= asset.useful_life_months,
    depreciationRate: (1 / asset.useful_life_months) * 12 * 100, // % /năm
  };
}

/** Tổng hợp khấu hao tháng này cho toàn bộ tài sản đang active */
export function sumMonthlyDepreciation(assets: FixedAsset[]): number {
  return assets
    .filter(a => a.status === 'active')
    .reduce((sum, a) => {
      const { monthlyDep, isFullyDepreciated } = calcDepreciation(a);
      return sum + (isFullyDepreciated ? 0 : monthlyDep);
    }, 0);
}

// ══════════════════════════════════════════════════
// Advances (Tạm ứng / Hoàn ứng)
// ══════════════════════════════════════════════════

export async function fetchAdvances(): Promise<Advance[]> {
  const { data, error } = await supabase
    .from('acc_advances')
    .select('*')
    .order('advance_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveAdvance(
  advance: Omit<Advance, 'id' | 'created_at' | 'updated_at'>
): Promise<Advance> {
  const { data, error } = await supabase
    .from('acc_advances')
    .insert({ entity: getWorkspace(), ...advance })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function settleAdvance(
  id: string,
  payload: {
    settled_amount: number;
    returned_amount: number;
    settlement_date: string;
    settlement_notes?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('acc_advances')
    .update({
      ...payload,
      status: 'settled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelAdvance(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_advances')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAdvance(id: string): Promise<void> {
  const { error } = await supabase.from('acc_advances').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════
// Bank Statements (Sao kê ngân hàng)
// ══════════════════════════════════════════════════

import { BankStatement, BankStatementRow, InvoiceData } from '@/types';

export async function fetchBankStatements(): Promise<BankStatement[]> {
  const { data, error } = await supabase
    .from('acc_bank_statements')
    .select('*')
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function importBankStatements(
  bank: string,
  rows: BankStatementRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const records = rows.map(r => ({
    bank_name: bank,
    transaction_date: r.transaction_date,
    description: r.description,
    amount: r.amount,
    transaction_type: r.transaction_type,
    reference_code: r.reference_code || null,
  }));
  const { error } = await supabase.from('acc_bank_statements').insert(records);
  if (error) throw error;
}

export async function matchBankStatement(
  id: string,
  matchedType: 'invoice' | 'expense' | 'advance',
  matchedId: string
): Promise<void> {
  const { error } = await supabase
    .from('acc_bank_statements')
    .update({ matched_type: matchedType, matched_id: matchedId })
    .eq('id', id);
  if (error) throw error;
}

export async function unmatchBankStatement(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_bank_statements')
    .update({ matched_type: null, matched_id: null })
    .eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════
// Invoices (lightweight fetch for P&L / reconciliation)
// ══════════════════════════════════════════════════

function parseInvoiceRow(row: any): InvoiceData {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date || '',
    dueDate: row.due_date || '',
    currency: row.currency || 'USD',
    taxRate: row.tax_rate ?? 0,
    discountType: row.discount_type || 'percentage',
    discountValue: row.discount_value ?? 0,
    theme: row.theme || 'dark',
    status: row.status || 'pending',
    paidDate: row.paid_date || undefined,
    payment_method: row.payment_method || '',
    clientInfo: row.client_info || { name: '', address: '', contactPerson: '', email: '' },
    studioInfo: row.studio_info || { name: '', address: '', email: '', taxCode: '' },
    bankingInfo: row.banking_info || { accountName: '', accountNumber: '', bankName: '', branchName: '', bankAddress: '', citadCode: '', swiftCode: '' },
    items: row.items || [],
    billing_entity: row.billing_entity || 'TD GAMES',
    crm_project_id: row.crm_project_id ?? null,
    receiving_account_id: row.receiving_account_id ?? null,
  };
}

export async function fetchInvoicesForAccounting(): Promise<InvoiceData[]> {
  const { data, error } = await supabase
    .from('invoice_invoices')
    .select('id, invoice_number, issue_date, due_date, currency, tax_rate, discount_type, discount_value, theme, status, paid_date, payment_method, client_info, studio_info, banking_info, items, billing_entity, crm_project_id, receiving_account_id')
    .order('issue_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(parseInvoiceRow);
}

// ══════════════════════════════════════════════════
// Expenses (lightweight fetch for Payables / P&L)
// ══════════════════════════════════════════════════

import { ExpenseRecord, PayPayrollRecord, PayPayrollSheet, HrEmployee } from '@/types';

export async function fetchExpensesForAccounting(): Promise<ExpenseRecord[]> {
  const { data, error } = await supabase
    .from('expense_expenses')
    .select('*, category:expense_categories(id, name, color, icon)')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ══════════════════════════════════════════════════
// Payroll (for TNCN tab)
// ══════════════════════════════════════════════════

export interface PayrollRecordWithMeta extends PayPayrollRecord {
  sheet?: PayPayrollSheet;
}

export async function fetchPayrollForTncn(): Promise<PayrollRecordWithMeta[]> {
  const { data, error } = await supabase
    .from('pay_payroll_records')
    .select('*, sheet:pay_payroll_sheets(id, month, year, title, status)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PayrollRecordWithMeta[];
}

export async function fetchEmployeesForAccounting(): Promise<HrEmployee[]> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select('id, full_name, tax_code, employee_code, status')
    .order('full_name');
  if (error) throw error;
  return (data || []) as HrEmployee[];
}

// ══════════════════════════════════════════════════
// Freelancer Settlements (for TNCN tab)
// ══════════════════════════════════════════════════

import { Settlement } from '@/types';

export async function fetchSettlementsForTncn(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('wf_settlements')
    .select('*, worker:wf_workers(id, full_name)')
    .in('status', ['paid', 'accepted'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Settlement[];
}

// ══════════════════════════════════════════════════
// BHXH (for BHXH tab)
// ══════════════════════════════════════════════════

export interface BhxhEmployee {
  id: string;
  employee_code: string;
  full_name: string;
  insurance_number: string;
  /** Lương cơ bản (component 'Lương cơ bản' hiện tại) — đây là mức đóng BHXH */
  bhxh_base: number;
  status: string;
  probation_end: string | null;
  official_date: string | null;
  start_date: string | null;
  department_name: string | null;
}

// ── BHXH Payment Status ───────────────────────────

export interface BhxhPayment {
  id: string;
  month: number;
  year: number;
  total_amount: number;
  paid_date: string;
  paid_by: string;
  notes: string;
  created_at: string;
}

export async function fetchBhxhPayment(month: number, year: number): Promise<BhxhPayment | null> {
  const { data, error } = await supabase
    .from('acc_bhxh_payments')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();
  if (error) throw error;
  return data as BhxhPayment | null;
}

export async function saveBhxhPayment(
  month: number,
  year: number,
  payload: { total_amount: number; paid_date: string; paid_by: string; notes: string },
): Promise<BhxhPayment> {
  // Upsert on (month, year)
  const { data, error } = await supabase
    .from('acc_bhxh_payments')
    .upsert({ month, year, ...payload, updated_at: new Date().toISOString() },
             { onConflict: 'month,year' })
    .select()
    .single();
  if (error) throw error;
  return data as BhxhPayment;
}

export async function deleteBhxhPayment(month: number, year: number): Promise<void> {
  const { error } = await supabase
    .from('acc_bhxh_payments')
    .delete()
    .eq('month', month)
    .eq('year', year);
  if (error) throw error;
}

// ── Employees ─────────────────────────────────────

export async function fetchEmployeesForBhxh(): Promise<BhxhEmployee[]> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      id, employee_code, full_name, insurance_number, status,
      probation_end, official_date, start_date,
      department:hr_departments!hr_employees_department_id_fkey(name),
      salaries:hr_employee_salary(amount, effective_to, component:hr_salary_components(name))
    `)
    .eq('status', 'active')
    .order('full_name');
  if (error) throw error;
  return ((data || []) as any[]).map(r => {
    // Lấy component 'Lương cơ bản' hiện tại (effective_to = null)
    const baseSalaryEntry = (r.salaries || []).find(
      (s: any) => s.effective_to === null && s.component?.name === 'Lương cơ bản'
    );
    return {
      id: r.id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      insurance_number: r.insurance_number || '',
      bhxh_base: baseSalaryEntry?.amount || 0,
      status: r.status,
      probation_end: r.probation_end,
      official_date: r.official_date,
      start_date: r.start_date,
      department_name: r.department?.name ?? null,
    };
  });
}
