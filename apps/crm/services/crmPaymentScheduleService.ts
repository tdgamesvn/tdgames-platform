// apps/crm/services/crmPaymentScheduleService.ts

import { supabase } from '@/services/supabaseClient';
import type { CrmPaymentSchedule } from '@/types';

// ── Extended type dùng trong tracker (join với project + client) ──
export interface PaymentScheduleWithProject extends CrmPaymentSchedule {
  project_name: string;
  client_name: string;
  client_id: string;
}

// ── Fetch theo project ───────────────────────────────────────────
export async function fetchPaymentSchedulesByProject(
  projectId: string
): Promise<CrmPaymentSchedule[]> {
  const { data, error } = await supabase
    .from('crm_payment_schedules')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── Fetch toàn bộ (dùng trong tracker) ──────────────────────────
export async function fetchAllPaymentSchedules(filters?: {
  status?: string;
  month?: string;
  clientId?: string;
}): Promise<PaymentScheduleWithProject[]> {
  let query = supabase
    .from('crm_payment_schedules')
    .select(`*, crm_projects(id, name, client_id, crm_clients(id, name))`)
    .order('due_date', { ascending: true });

  if (filters?.status === 'overdue') {
    const today = new Date().toISOString().slice(0, 10);
    query = query.eq('status', 'pending').lt('due_date', today);
  } else if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.month) {
    const [y, m] = filters.month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    query = query
      .gte('due_date', `${filters.month}-01`)
      .lte('due_date', `${filters.month}-${pad(lastDay)}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((r: any): PaymentScheduleWithProject => ({
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    due_date: r.due_date,
    status: r.status,
    invoiced_at: r.invoiced_at,
    paid_at: r.paid_at,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    project_name: r.crm_projects?.name ?? '',
    client_name: r.crm_projects?.crm_clients?.name ?? '',
    client_id: r.crm_projects?.client_id ?? '',
  }));

  if (filters?.clientId) {
    return rows.filter(r => r.client_id === filters.clientId);
  }
  return rows;
}

// ── CRUD ─────────────────────────────────────────────────────────
export async function createPaymentSchedule(
  data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmPaymentSchedule> {
  const { data: row, error } = await supabase
    .from('crm_payment_schedules')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function updatePaymentSchedule(
  id: string,
  updates: Partial<Pick<CrmPaymentSchedule, 'name' | 'amount' | 'currency' | 'due_date' | 'notes'>>
): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function markPaymentScheduleInvoiced(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update({ status: 'invoiced', invoiced_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markPaymentSchedulePaid(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePaymentSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
