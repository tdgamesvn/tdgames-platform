import { supabase } from '@/services/supabaseClient';
import { ProjectAcceptance, WorkforceTask } from '@/types';

// ── Discount helpers ───────────────────────────────────────────
// ponytail: total_amount trong DB = subtotal (chưa trừ discount); net tính lúc hiển thị
export const calcDiscount = (subtotal: number, type: string | undefined, value: number | undefined) =>
  type === 'percent' ? subtotal * (value || 0) / 100 : (value || 0);

export const acceptanceNetAmount = (a: { total_amount: number; discount_type?: string; discount_value?: number }) =>
  Math.max(0, (a.total_amount || 0) - calcDiscount(a.total_amount || 0, a.discount_type, a.discount_value));

// ── Fetch all project acceptances ─────────────────────────────
export async function fetchProjectAcceptances(): Promise<ProjectAcceptance[]> {
  const { data, error } = await supabase
    .from('wf_project_acceptances')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Create project acceptance ─────────────────────────────────
export async function createProjectAcceptance(
  projectName: string,
  clientName: string,
  period: string,
  taskIds: string[],
  totalAmount: number,
  currency: string,
  notes: string,
  clientPrices?: Record<string, number>,
  accountType: 'company' | 'personal' = 'company'
): Promise<ProjectAcceptance> {
  const { data, error } = await supabase
    .from('wf_project_acceptances')
    .insert({
      project_name: projectName,
      client_name: clientName,
      period,
      total_tasks: taskIds.length,
      total_amount: totalAmount,
      currency,
      notes,
      account_type: accountType,
    })
    .select()
    .single();
  if (error) throw error;

  // Link tasks with client prices
  if (taskIds.length > 0) {
    const links = taskIds.map(tid => ({
      acceptance_id: data.id,
      task_id: tid,
      client_price: clientPrices?.[tid] ?? 0,
    }));
    const { error: lErr } = await supabase.from('wf_project_acceptance_tasks').insert(links);
    if (lErr) throw lErr;
  }

  return data;
}

// ── Update project acceptance ─────────────────────────────────
export async function updateProjectAcceptance(
  id: string,
  updates: Partial<ProjectAcceptance>
): Promise<void> {
  const { error } = await supabase
    .from('wf_project_acceptances')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ── Delete project acceptance ─────────────────────────────────
export async function deleteProjectAcceptance(id: string): Promise<void> {
  // Links auto-deleted via ON DELETE CASCADE
  const { error } = await supabase
    .from('wf_project_acceptances')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Fetch tasks for a project acceptance (includes client_price) ──
export async function fetchProjectAcceptanceTasks(
  acceptanceId: string
): Promise<(WorkforceTask & { client_price: number })[]> {
  const { data, error } = await supabase
    .from('wf_project_acceptance_tasks')
    .select('client_price, note, task:wf_tasks(*, worker:wf_workers(*))')
    .eq('acceptance_id', acceptanceId);
  if (error) throw error;
  return (data || []).map((d: any) => ({
    ...d.task,
    client_price: d.client_price ?? 0,
    acceptance_note: d.note ?? '',
  }));
}

// ── Update client_price for a single acceptance task ──────────
export async function updateAcceptanceTaskClientPrice(
  acceptanceId: string,
  taskId: string,
  clientPrice: number
): Promise<void> {
  const { error } = await supabase
    .from('wf_project_acceptance_tasks')
    .update({ client_price: clientPrice })
    .eq('acceptance_id', acceptanceId)
    .eq('task_id', taskId);
  if (error) throw error;
}

// ── Update note for a single acceptance task ──────────────
export async function updateAcceptanceTaskNote(
  acceptanceId: string,
  taskId: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from('wf_project_acceptance_tasks')
    .update({ note })
    .eq('acceptance_id', acceptanceId)
    .eq('task_id', taskId);
  if (error) throw error;
}

// ── Fetch task IDs already in any acceptance ──────────────────
export async function fetchAcceptedTaskIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('wf_project_acceptance_tasks')
    .select('task_id');
  if (error) throw error;
  return new Set((data || []).map((r: any) => r.task_id));
}

// ── Update total_amount on the acceptance header ──────────────
export async function recalcAcceptanceTotal(acceptanceId: string): Promise<number> {
  const { data, error } = await supabase
    .from('wf_project_acceptance_tasks')
    .select('client_price')
    .eq('acceptance_id', acceptanceId);
  if (error) throw error;
  const total = (data || []).reduce((s: number, r: any) => s + (r.client_price || 0), 0);
  await supabase
    .from('wf_project_acceptances')
    .update({ total_amount: total })
    .eq('id', acceptanceId);
  return total;
}
