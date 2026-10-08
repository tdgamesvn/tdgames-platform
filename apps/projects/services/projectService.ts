import { supabase } from '@/services/supabaseClient';
import { getWorkspace } from '@/services/WorkspaceContext';

// Chỉ đọc qua view pm_* (migration 20261008100000) — KHÔNG có cột tiền.
// PM không có quyền trên wf_tasks; đừng đổi sang đọc bảng gốc.

export interface PmTask {
  id: string; worker_id: string | null; project: string | null; client_name: string | null; title: string;
  clickup_task_id: string | null; clickup_status: string | null; status: string | null;
  start_date: string | null; due_date: string | null; completed_at: string | null; closed_date: string | null;
  clickup_space_name: string | null; clickup_folder_name: string | null; clickup_list_name: string | null;
  clickup_updated_at: string | null; created_at: string;
}
export interface PmWorker { id: string; full_name: string; email: string | null; type: string | null; is_active: boolean | null; }
export interface PmStatusLog { task_id: string; from_status: string | null; to_status: string | null; changed_at: string; }
export type SubtaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export interface PmSubtask {
  id: string; title: string; description: string | null; project: string | null;
  parent_task_id: string | null; assignee_worker_id: string | null;
  status: SubtaskStatus; priority: 'low' | 'normal' | 'high';
  due_date: string | null; completed_at: string | null; created_at: string;
}

/** Trạng thái ClickUp coi là XONG — khớp DONE_STATUSES của Workforce. */
export const DONE_STATUSES = ['client_review', 'approved', 'closed', 'done', 'completed', 'complete'];
export const norm = (s?: string | null) => (s || '').trim().toLowerCase();
export const isDone = (t: PmTask) => DONE_STATUSES.includes(norm(t.clickup_status));
export const isFix = (t: PmTask) => norm(t.clickup_status) === 'fix';
export const todayISO = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // giờ VN
export const isOverdue = (t: { due_date: string | null }, done: boolean) => !done && !!t.due_date && t.due_date < todayISO();
/** Tên dự án hiển thị: folder ClickUp (thường = dự án) → list → project. */
export const projectOf = (t: PmTask) => t.clickup_folder_name || t.project || t.clickup_list_name || '(Không rõ)';

export async function fetchPmData() {
  const [tasks, assignees, workers, logs] = await Promise.all([
    supabase.from('pm_tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('pm_task_assignees').select('task_id, worker_id'),
    supabase.from('pm_workers').select('*').order('full_name'),
    supabase.from('pm_task_status_log').select('task_id, from_status, to_status, changed_at'),
  ]);
  for (const r of [tasks, assignees, workers, logs]) if (r.error) throw r.error;
  return {
    tasks: (tasks.data || []) as PmTask[],
    assignees: (assignees.data || []) as { task_id: string; worker_id: string }[],
    workers: (workers.data || []) as PmWorker[],
    logs: (logs.data || []) as PmStatusLog[],
  };
}

export async function fetchSubtasks(): Promise<PmSubtask[]> {
  const { data, error } = await supabase.from('pm_subtasks').select('*')
    .eq('entity', getWorkspace()).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PmSubtask[];
}

export async function createSubtask(s: Partial<PmSubtask>): Promise<PmSubtask> {
  const { data, error } = await supabase.from('pm_subtasks')
    .insert({ ...s, entity: getWorkspace() }).select().single();
  if (error) throw error;
  return data as PmSubtask;
}

export async function updateSubtask(id: string, patch: Partial<PmSubtask>): Promise<PmSubtask> {
  const { data, error } = await supabase.from('pm_subtasks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as PmSubtask;
}

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase.from('pm_subtasks').delete().eq('id', id);
  if (error) throw error;
}
