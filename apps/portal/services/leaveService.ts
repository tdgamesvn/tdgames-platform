import { supabase } from '@/services/supabaseClient';
import { LeaveBalance, AttRequest } from '@/types';

// ══════════════════════════════════════════════════════════
// ── Leave Balance (read-only) ─────────────────────────────
// ══════════════════════════════════════════════════════════
// accrued_days is owned by the DB (trigger auto_create_leave_balance +
// daily cron refresh_leave_balances): +1 day per calendar month where the
// employee has been official for >= 2/3 of that month's days (>= 50% for
// official_date before 2026-09-10 — grandfathered; counted from official_date,
// fallback probation_end+1), quarter=0. Leftover at year end carries over to
// quarter=1 of next year, usable until 31/3 then expired (migration
// 20260910120000; accrual rule 20260910110000). Frontend
// only reads; it must not calculate or write accrual anymore.

// quarter=0: phép năm nay; quarter=1: phép năm trước chuyển sang, dùng đến 31/3
// (migration 20260910120000). Gộp 2 dòng thành 1 để UI/available tính chung.
export async function fetchYearlyBalance(employeeId: string, year: number): Promise<LeaveBalance | null> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .in('quarter', [0, 1]);
  if (error && error.code !== '42P01') throw error;
  const rows = data || [];
  const base = rows.find(r => r.quarter === 0);
  if (!base) return null;
  const co = rows.find(r => r.quarter === 1);
  if (!co) return base;
  return {
    ...base,
    accrued_days: Number(base.accrued_days || 0) + Number(co.accrued_days || 0),
    used_days:    Number(base.used_days || 0)    + Number(co.used_days || 0),
    expired_days: Number(base.expired_days || 0) + Number(co.expired_days || 0),
  };
}

/**
 * Get the available leave days for the employee right now.
 */
export function getAvailableLeaveDays(yearlyBalance: LeaveBalance | null): {
  accrued: number;
  used: number;
  expired: number;
  available: number;
} {
  const accrued  = Number(yearlyBalance?.accrued_days || 0);
  const used     = Number(yearlyBalance?.used_days || 0);
  const expired  = Number(yearlyBalance?.expired_days || 0);
  return { accrued, used, expired, available: Math.max(0, accrued - used - expired) };
}

// ══════════════════════════════════════════════════════════
// ── Leave Request CRUD ────────────────────────────────────
// ══════════════════════════════════════════════════════════

/** `types` mở rộng để màn "đang chờ duyệt" lấy kèm đơn quên chấm, mặc định vẫn chỉ đơn nghỉ. */
export async function fetchMyLeaveRequests(employeeId: string, types: string[] = ['leave']): Promise<AttRequest[]> {
  const { data, error } = await supabase
    .from('att_requests')
    .select('*, employee:hr_employees(*)')
    .eq('employee_id', employeeId)
    .in('request_type', types)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitLeaveRequest(
  employeeId: string,
  dateFrom: string,
  dateTo: string,
  leaveDays: number,
  leaveType: 'annual' | 'unpaid' | 'birthday' | 'remote' | 'hieu_hi',
  reason: string,
  opts?: { leaveHours?: number; timeFrom?: string; timeTo?: string }
): Promise<AttRequest> {
  const { data, error } = await supabase
    .from('att_requests')
    .insert({
      employee_id: employeeId,
      request_type: 'leave',
      date_from: dateFrom,
      date_to: dateTo,
      leave_days: leaveDays,
      leave_hours: opts?.leaveHours ?? null,
      time_from: opts?.timeFrom ?? null,
      time_to: opts?.timeTo ?? null,
      leave_type: leaveType,
      reason,
      status: 'pending',
      reviewer_note: '',
    })
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════
// ── Admin: Approval ───────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchAllLeaveRequests(status?: string): Promise<AttRequest[]> {
  let q = supabase
    .from('att_requests')
    .select('*, employee:hr_employees(*)')
    .eq('request_type', 'leave')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function approveLeaveRequest(
  requestId: string,
  approvedBy: string,
  reviewerNote: string = ''
): Promise<void> {
  // Update request status. DB trigger `handle_leave_request_status_change`
  // (fires on UPDATE OF status) deducts used_days from leave_balances for
  // annual leave — do NOT also deduct here, that double-counts (was the
  // root cause of 0.5-day requests deducting 1.0 day). See LOG 2026-07-13.
  const { error } = await supabase
    .from('att_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      reviewer_note: reviewerNote,
    })
    .eq('id', requestId);
  if (error) throw error;
  await resyncAttendanceForRequest(requestId);
}

/**
 * Tính lại bảng công các tháng mà đơn phủ — ngay lúc duyệt/huỷ, khỏi chờ cron đêm.
 * RPC `att_resync_for_dates` tự bỏ qua nếu người gọi không phải HR/admin, tháng đã chốt
 * hoặc trước `att_sync_from_month`. Lỗi ở đây không được làm hỏng việc duyệt ⇒ nuốt lỗi.
 */
export async function resyncAttendanceFor(dateFrom?: string | null, dateTo?: string | null): Promise<void> {
  if (!dateFrom) return;
  try {
    const { error } = await supabase.rpc('att_resync_for_dates', { _from: dateFrom, _to: dateTo || dateFrom });
    if (error) throw error;
  } catch (e) {
    console.error('Không tính lại được bảng công:', e);
  }
}

async function resyncAttendanceForRequest(requestId: string): Promise<void> {
  const { data } = await supabase
    .from('att_requests').select('date_from, date_to').eq('id', requestId).maybeSingle();
  if (data) await resyncAttendanceFor(data.date_from, data.date_to);
}

export async function rejectLeaveRequest(
  requestId: string,
  approvedBy: string,
  reviewerNote: string = ''
): Promise<void> {
  const { error } = await supabase
    .from('att_requests')
    .update({
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      reviewer_note: reviewerNote,
    })
    .eq('id', requestId);
  if (error) throw error;
  // Từ chối đơn đã duyệt → trigger hoàn phép, bảng công cũng phải trừ lại công phép.
  await resyncAttendanceForRequest(requestId);
}

export async function deleteLeaveRequest(requestId: string): Promise<void> {
  const { data: req, error: fetchErr } = await supabase
    .from('att_requests')
    .select('status, date_from, date_to')
    .eq('id', requestId)
    .single();
  if (fetchErr) throw fetchErr;

  // Hoàn phép do trigger DB `trg_leave_request_delete` lo (hoàn đúng carry-over / phép năm,
  // migration 20261007130100). KHÔNG hoàn ở đây nữa — làm cả 2 nơi là hoàn 2 lần.
  const { error } = await supabase
    .from('att_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;

  if (req.status === 'approved') await resyncAttendanceFor(req.date_from, req.date_to);
}
