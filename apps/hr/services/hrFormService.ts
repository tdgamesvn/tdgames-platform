// HR Forms (Khảo sát) — giai đoạn 1. Schema: migration 20261006100000_hr_forms.sql.
// Nhân viên chỉ ghi qua RPC hr_form_submit; HR mở/nhắc qua RPC (tự bắn notifications → push).
import { supabase } from '@/services/supabaseClient';
import { getWorkspace } from '@/services/WorkspaceContext';

export type HrFormStatus = 'draft' | 'open' | 'closed';
export type HrQuestionKind = 'text' | 'textarea' | 'single_choice' | 'multi_choice' | 'rating' | 'scale';

export interface HrForm {
  id: string;
  title: string;
  description?: string | null;
  kind: 'survey' | 'peer_review';
  is_anonymous: boolean;
  deadline?: string | null;
  status: HrFormStatus;
  entity?: string | null;
  created_at: string;
  opened_at?: string | null;
}

export interface HrFormQuestion {
  id: string;
  form_id: string;
  position: number;
  kind: HrQuestionKind;
  label: string;
  /** choice: string[]; scale: { min, max } */
  options: any;
  required: boolean;
}

export interface HrFormAssignment {
  id: string;
  form_id: string;
  respondent_employee_id: string;
  submitted_at?: string | null;
  form?: HrForm;
}

export interface HrFormResponse {
  id: string;
  respondent_employee_id?: string | null;
  answers: Record<string, any>;
  submitted_on: string;
}

export const QUESTION_KIND_LABEL: Record<HrQuestionKind, string> = {
  text: 'Trả lời ngắn',
  textarea: 'Đoạn văn',
  single_choice: 'Chọn 1',
  multi_choice: 'Chọn nhiều',
  rating: 'Chấm sao 1–5',
  scale: 'Thang điểm',
};

const err = (e: any) => { if (e) throw new Error(e.message || String(e)); };

// ─── HR ──────────────────────────────────────────────────────────────────────
export async function fetchForms(): Promise<HrForm[]> {
  const { data, error } = await supabase.from('hr_forms').select('*').order('created_at', { ascending: false });
  err(error);
  return data || [];
}

export async function fetchQuestions(formId: string): Promise<HrFormQuestion[]> {
  const { data, error } = await supabase.from('hr_form_questions').select('*').eq('form_id', formId).order('position');
  err(error);
  return data || [];
}

export async function saveForm(form: Partial<HrForm>): Promise<HrForm> {
  const row = {
    title: form.title, description: form.description || null,
    is_anonymous: !!form.is_anonymous, deadline: form.deadline || null,
  };
  const q = form.id
    ? supabase.from('hr_forms').update(row).eq('id', form.id)
    : supabase.from('hr_forms').insert({ ...row, kind: 'survey', entity: getWorkspace() });
  const { data, error } = await q.select().single();
  err(error);
  return data as HrForm;
}

/** Ghi đè toàn bộ câu hỏi (chỉ dùng khi form còn draft — đã mở thì câu trả lời đang tham chiếu id câu hỏi). */
export async function replaceQuestions(formId: string, qs: Omit<HrFormQuestion, 'id' | 'form_id'>[]): Promise<void> {
  const del = await supabase.from('hr_form_questions').delete().eq('form_id', formId);
  err(del.error);
  if (!qs.length) return;
  const { error } = await supabase.from('hr_form_questions')
    .insert(qs.map((q, i) => ({ ...q, form_id: formId, position: i })));
  err(error);
}

export async function deleteForm(id: string): Promise<void> {
  const { error } = await supabase.from('hr_forms').delete().eq('id', id);
  err(error);
}

export async function setFormStatus(id: string, status: HrFormStatus): Promise<void> {
  const { error } = await supabase.from('hr_forms').update({ status }).eq('id', id);
  err(error);
}

/** Mở form + giao cho danh sách nhân viên. Trả về số thông báo đã gửi. */
export async function openForm(formId: string, employeeIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('hr_form_open', { p_form_id: formId, p_employee_ids: employeeIds });
  err(error);
  return data as number;
}

export async function remindForm(formId: string): Promise<number> {
  const { data, error } = await supabase.rpc('hr_form_remind', { p_form_id: formId });
  err(error);
  return data as number;
}

export async function fetchAssignments(formId: string): Promise<HrFormAssignment[]> {
  const { data, error } = await supabase.from('hr_form_assignments').select('*').eq('form_id', formId);
  err(error);
  return data || [];
}

export async function fetchResponses(formId: string): Promise<HrFormResponse[]> {
  const { data, error } = await supabase.from('hr_form_responses')
    .select('id, respondent_employee_id, answers, submitted_on').eq('form_id', formId);
  err(error);
  return data || [];
}

// ─── Portal (nhân viên) ─────────────────────────────────────────────────────
export async function fetchMyAssignments(employeeId: string): Promise<HrFormAssignment[]> {
  const { data, error } = await supabase.from('hr_form_assignments')
    .select('*, form:hr_forms(*)')
    .eq('respondent_employee_id', employeeId)
    .order('created_at', { ascending: false });
  err(error);
  // form null = draft (RLS ẩn) — bỏ
  return (data || []).filter((a: any) => a.form);
}

export async function fetchMyResponse(assignmentId: string): Promise<HrFormResponse | null> {
  const { data, error } = await supabase.from('hr_form_responses')
    .select('id, respondent_employee_id, answers, submitted_on').eq('assignment_id', assignmentId).maybeSingle();
  err(error);
  return data;
}

export async function submitForm(assignmentId: string, answers: Record<string, any>): Promise<void> {
  const { error } = await supabase.rpc('hr_form_submit', { p_assignment_id: assignmentId, p_answers: answers });
  err(error);
}

/** Form còn nhận bài? (hạn tính hết ngày giờ VN — khớp RPC) */
export function isFormAcceptingAnswers(f: HrForm): boolean {
  if (f.status !== 'open') return false;
  if (!f.deadline) return true;
  const todayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  return todayVN <= f.deadline;
}
