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
  time_estimate_hours: number | null; // ClickUp time_estimate (giờ)
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

// ── Thời gian làm task (migration 20261008120000) ──
export interface PmTaskTime {
  task_id: string; worker_id: string; is_fulltime: boolean;
  active_hours: number; active_calendar_hours: number; waiting_client_hours: number;
  fix_rounds: number; first_client_review_at: string | null; tracked_since: string | null;
  current_status: string | null; current_status_since: string | null;
}
export interface PmInterval { task_id: string; status: string; category: string; started_at: string; ended_at: string | null; }

export async function fetchTaskTime(): Promise<PmTaskTime[]> {
  const { data, error } = await supabase.from('pm_task_time').select('*');
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r, active_hours: Number(r.active_hours), active_calendar_hours: Number(r.active_calendar_hours),
    waiting_client_hours: Number(r.waiting_client_hours), fix_rounds: Number(r.fix_rounds),
  }));
}

export async function fetchTaskIntervals(taskId: string): Promise<PmInterval[]> {
  const { data, error } = await supabase.from('pm_task_status_intervals')
    .select('task_id, status, category, started_at, ended_at').eq('task_id', taskId).order('started_at');
  if (error) throw error;
  return (data || []) as PmInterval[];
}

/** Tên trạng thái ClickUp → tiếng Việt dễ hiểu cho người dùng (khớp label trong wf_status_categories). */
const STATUS_VI: Record<string, string> = {
  'in progress': 'Đang làm', fix: 'Đang sửa', lead_check: 'Lead kiểm tra', 'internal review': 'Review nội bộ',
  client_review: 'Chờ khách duyệt', pending: 'Tạm dừng', backlog: 'Chưa làm', 'new request': 'Yêu cầu mới',
  planning: 'Lên kế hoạch', approved: 'Khách đã duyệt', closed: 'Đã đóng', completed: 'Hoàn thành',
  complete: 'Hoàn thành', done: 'Xong', cancelled: 'Đã huỷ',
};
export const statusLabel = (s?: string | null) => STATUS_VI[norm(s)] || s || '—';
export const workerTypeLabel = (t?: string | null) => (t === 'freelancer' ? 'Freelancer' : t ? 'Nội bộ' : '—');

/** Mốc chuẩn hoá Time Estimate (sếp 08/10/2026): chỉ nhắc task TẠO từ ngày này — task cũ không có estimate.
 *  Khớp hằng số trong SQL pm_notify_stuck_tasks (migration 20261008160000). */
export const ESTIMATE_REQUIRED_FROM = '2026-10-08';

/** Ngưỡng "task đứng" (giờ đồng hồ ở trạng thái hiện tại). */
export const STUCK_HOURS: Record<string, number> = { active: 48, waiting_client: 120 };
export const hoursSince = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600_000 : 0);
