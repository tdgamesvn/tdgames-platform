// apps/tax-portal/services/taxPortalService.ts
import { supabase } from '@/services/supabaseClient';

export interface TaxInvoice {
  id: string;
  status: string;
  currency: string;
  amount_received: number | null;
  items: any;
  issue_date: string | null;
  paid_date: string | null;
  due_date: string | null;
  created_at: string;
  client_info: any;
  billing_entity: string | null;
  einvoice_invoice_number: string | null;
  einvoice_pdf_url: string | null;
}

export interface TaxExpense {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  expense_date: string;
  vendor: string | null;
  category_id: string | null;
  description: string | null;
}

export interface TaxBankAccount {
  id: string;
  name: string;
  bank_name: string;
  currency: string;
}

export interface TaxBankSnapshot {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: string;
}

export interface TaxSaving {
  id: string;
  amount: number;
  bank_name: string | null;
  term_months: number | null;
  interest_rate: number | null;
  start_date: string;
  maturity_date: string | null;
  status: string;
}

export interface TaxLoan {
  id: string;
  amount: number;
  lender: string | null;
  interest_rate: number | null;
  start_date: string;
  due_date: string | null;
  status: string;
}

export interface TaxBhxhPayment {
  id: string;
  amount: number;
  payment_date: string;
  period: string | null;
}

export interface TaxFxRate {
  id: string;
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
}

export interface TaxPayrollSheet {
  id: string;
  title: string;
  status: string;
  month: number;
  year: number;
}

export interface TaxPayrollRecord {
  id: string;
  sheet_id: string;
  employee_id: string;
  gross_salary: number;
  net_salary: number;
  pit: number;
  bhxh_employee: number;
  bhxh_company: number;
}

export interface TaxEmployee {
  id: string;
  employee_code: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  id_number: string | null;
  id_issue_date: string | null;
  id_issue_place: string | null;
  address: string | null;
  insurance_number: string | null;
  tax_code: string | null;
  start_date: string | null;
  official_date: string | null;
  position: string | null;
  department_id: string | null;
  status: string | null;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
}

export async function fetchTaxInvoices(): Promise<TaxInvoice[]> {
  const { data, error } = await supabase
    .from('invoice_invoices')
    .select('id, status, currency, amount_received, items, issue_date, paid_date, due_date, created_at, client_info, billing_entity, einvoice_invoice_number, einvoice_pdf_url')
    .order('issue_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxInvoice[];
}

export async function fetchTaxExpenses(): Promise<TaxExpense[]> {
  // ponytail: expense_expenses has no `description` column — alias `title` as description.
  // Chỉ lấy type='expense' — các dòng type='revenue' (nghiệm thu khách hàng, giải ngân vay,
  // tất toán tiết kiệm) không phải chi phí, và doanh thu thuế đã lấy từ invoice_invoices rồi
  // (tránh double-count với hoá đơn cần xuất).
  const { data, error } = await supabase
    .from('expense_expenses')
    .select('id, amount, currency, type, status, expense_date, vendor, category_id, description:title')
    .eq('type', 'expense')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as TaxExpense[];
}

export async function fetchTaxBankAccounts(): Promise<TaxBankAccount[]> {
  const { data, error } = await supabase.from('finance_bank_accounts').select('id, name, bank_name, currency');
  if (error) throw error;
  return (data || []) as TaxBankAccount[];
}

export async function fetchTaxBankSnapshots(): Promise<TaxBankSnapshot[]> {
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('id, account_id, balance, snapshot_date, source')
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxBankSnapshot[];
}

export async function fetchTaxSavings(): Promise<TaxSaving[]> {
  // ponytail: acc_savings column is `principal`, not `amount` — alias to match interface.
  const { data, error } = await supabase
    .from('acc_savings')
    .select('id, amount:principal, bank_name, term_months, interest_rate, start_date, maturity_date, status');
  if (error) throw error;
  return (data || []) as unknown as TaxSaving[];
}

export async function fetchTaxLoans(): Promise<TaxLoan[]> {
  // ponytail: acc_loans columns are `principal`/`lender_name`, not `amount`/`lender` — alias to match interface.
  const { data, error } = await supabase
    .from('acc_loans')
    .select('id, amount:principal, lender:lender_name, interest_rate, start_date, due_date, status');
  if (error) throw error;
  return (data || []) as unknown as TaxLoan[];
}

export async function fetchTaxBhxhPayments(): Promise<TaxBhxhPayment[]> {
  // ponytail: acc_bhxh_payments has `total_amount`/`paid_date`/`month`+`year`, no single `amount`/`payment_date`/`period`
  // column — alias the first two and compose `period` client-side as "M/YYYY".
  const { data, error } = await supabase
    .from('acc_bhxh_payments')
    .select('id, amount:total_amount, payment_date:paid_date, month, year')
    .order('paid_date', { ascending: false });
  if (error) throw error;
  return ((data || []) as any[]).map(r => ({
    id: r.id,
    amount: r.amount,
    payment_date: r.payment_date,
    period: r.month && r.year ? `${r.month}/${r.year}` : null,
  }));
}

export async function fetchTaxFxRates(): Promise<TaxFxRate[]> {
  const { data, error } = await supabase
    .from('finance_fx_rates')
    .select('id, rate_date, from_currency, to_currency, rate, source')
    .order('rate_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxFxRate[];
}

export async function fetchTaxPayrollSheets(): Promise<TaxPayrollSheet[]> {
  const { data, error } = await supabase
    .from('pay_payroll_sheets')
    .select('id, title, status, month, year')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxPayrollSheet[];
}

export async function fetchTaxPayrollRecords(sheetId: string): Promise<TaxPayrollRecord[]> {
  // ponytail: pay_payroll_records columns are `gross_actual`/`employee_bhxh`/`company_bhxh`,
  // not `gross_salary`/`bhxh_employee`/`bhxh_company` — alias to match interface.
  const { data, error } = await supabase
    .from('pay_payroll_records')
    .select('id, sheet_id, employee_id, gross_salary:gross_actual, net_salary, pit, bhxh_employee:employee_bhxh, bhxh_company:company_bhxh')
    .eq('sheet_id', sheetId);
  if (error) throw error;
  return (data || []) as unknown as TaxPayrollRecord[];
}

// Reads from `hr_employees_tax_view` (migration 20260708110000) — a column-limited
// view, NOT the full `hr_employees` table. Only BHXH-relevant fields are exposed;
// salary, bank account, internal notes etc. are never selectable through this path.
export async function fetchTaxEmployees(): Promise<TaxEmployee[]> {
  const { data, error } = await supabase
    .from('hr_employees_tax_view')
    .select('id, employee_code, full_name, date_of_birth, gender, id_number, id_issue_date, id_issue_place, address, insurance_number, tax_code, start_date, official_date, position, department_id, status, id_card_front_url, id_card_back_url')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data || []) as TaxEmployee[];
}
