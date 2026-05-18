import { supabase } from '@/services/supabaseClient';
import { ExpenseCategory, ExpenseRecord, RecurringExpense } from '@/types';

// ── Categories ────────────────────────────────────────────────
export async function fetchCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveCategory(cat: Omit<ExpenseCategory, 'id'>): Promise<ExpenseCategory> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert(cat)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, updates: Partial<ExpenseCategory>): Promise<void> {
  const { error } = await supabase.from('expense_categories').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id);
  if (error) throw error;
}

// ── Expenses ──────────────────────────────────────────────────
export async function fetchExpenses(): Promise<ExpenseRecord[]> {
  const { data, error } = await supabase
    .from('expense_expenses')
    .select('*, category:expense_categories(*)')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveExpense(expense: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<ExpenseRecord> {
  const { data, error } = await supabase
    .from('expense_expenses')
    .insert(expense)
    .select('*, category:expense_categories(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id: string, updates: Partial<ExpenseRecord>): Promise<void> {
  const { category, ...clean } = updates as any;
  const { error } = await supabase
    .from('expense_expenses')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expense_expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function approveExpense(id: string, approverId: string, note?: string): Promise<void> {
  const { error } = await supabase
    .from('expense_expenses')
    .update({
      status: 'approved',
      approver_id: approverId,
      approved_at: new Date().toISOString(),
      approval_note: note ?? '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectExpense(id: string, approverId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('expense_expenses')
    .update({
      status: 'pending',
      approver_id: approverId,
      approved_at: new Date().toISOString(),
      approval_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

// ── Recurring ─────────────────────────────────────────────────
export async function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from('expense_recurring')
    .select('*, category:expense_categories(*)')
    .order('next_run');
  if (error) throw error;
  return data || [];
}

export async function saveRecurringExpense(item: Omit<RecurringExpense, 'id' | 'created_at' | 'category'>): Promise<RecurringExpense> {
  const { data, error } = await supabase
    .from('expense_recurring')
    .insert(item)
    .select('*, category:expense_categories(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecurringExpense(id: string, updates: Partial<RecurringExpense>): Promise<void> {
  const { category, ...clean } = updates as any;
  const { error } = await supabase.from('expense_recurring').update(clean).eq('id', id);
  if (error) throw error;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expense_recurring').delete().eq('id', id);
  if (error) throw error;
}

// ── Budgets ───────────────────────────────────────────────────
export interface BudgetRecord {
  id?: string;
  month: number;
  year: number;
  category_id: string | null;
  label: string;
  amount: number;
  currency: 'VND' | 'USD';
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export async function fetchBudgets(year?: number): Promise<BudgetRecord[]> {
  let q = supabase.from('expense_budgets').select('*').order('year', { ascending: false }).order('month', { ascending: false });
  if (year) q = q.eq('year', year);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveBudget(budget: Omit<BudgetRecord, 'id' | 'created_at' | 'updated_at'>): Promise<BudgetRecord> {
  const { data, error } = await supabase
    .from('expense_budgets')
    .upsert(budget, { onConflict: 'month,year,category_id,currency' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('expense_budgets').delete().eq('id', id);
  if (error) throw error;
}

// ── Invoice Revenue Sync ──────────────────────────────────────
export async function syncInvoiceRevenue(): Promise<{ inserted: number; updated: number }> {
  const { data, error } = await supabase.rpc('sync_invoice_revenue');
  if (error) throw error;
  return data as { inserted: number; updated: number };
}

// ── Export ─────────────────────────────────────────────────────
export function exportToCSV(expenses: ExpenseRecord[], filename: string) {
  const headers = ['Date', 'Type', 'Source', 'Title', 'Amount', 'Currency', 'Category', 'Vendor', 'Status', 'Notes'];
  const rows = expenses.map(e => [
    e.expense_date,
    e.type || 'expense',
    e.source_type || 'manual',
    `"${(e.title || '').replace(/"/g, '""')}"`,
    e.amount,
    e.currency,
    `"${(e.category?.name || '').replace(/"/g, '""')}"`,
    `"${(e.vendor || '').replace(/"/g, '""')}"`,
    e.status,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
