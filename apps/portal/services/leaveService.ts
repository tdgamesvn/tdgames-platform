import { supabase } from '@/services/supabaseClient';
import { LeaveBalance, AttRequest } from '@/types';

// ══════════════════════════════════════════════════════════
// ── Leave Balance (read-only) ─────────────────────────────
// ══════════════════════════════════════════════════════════
// accrued_days is owned by the DB (trigger auto_create_leave_balance +
// monthly cron refresh_leave_balances): +1 day per completed month since
// official_date (fallback probation_end+1), quarter=0, reset every year
// — NO carry-over to next year. See migration 20260707170000. Frontend
// only reads; it must not calculate or write accrual anymore.

export async function fetchYearlyBalance(employeeId: string, year: number): Promise<LeaveBalance | null> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', year)
    .eq('quarter', 0)
    .maybeSingle();
  if (error && error.code !== '42P01') throw error;
  return data || null;
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

export async function fetchMyLeaveRequests(employeeId: string): Promise<AttRequest[]> {
  const { data, error } = await supabase
    .from('att_requests')
    .select('*, employee:hr_employees(*)')
    .eq('employee_id', employeeId)
    .eq('request_type', 'leave')
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
}

export async function deleteLeaveRequest(requestId: string): Promise<void> {
  // Get request info first to check if we need to refund balance
  const { data: req, error: fetchErr } = await supabase
    .from('att_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (fetchErr) throw fetchErr;

  // If it was approved annual leave, refund the used_days
  if (req.status === 'approved' && req.leave_type === 'annual') {
    const reqDate = new Date(req.date_from);
    const year = reqDate.getFullYear();
    const leaveDays = Number(req.leave_days || 0);

    // Refund to yearly balance first
    const { data: yearly } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', req.employee_id)
      .eq('year', year)
      .eq('quarter', 0)
      .maybeSingle();

    if (yearly) {
      const newUsed = Math.max(0, Number(yearly.used_days || 0) - leaveDays);
      await supabase
        .from('leave_balances')
        .update({ used_days: newUsed })
        .eq('id', yearly.id);
    }
  }

  // Delete the request
  const { error } = await supabase
    .from('att_requests')
    .delete()
    .eq('id', requestId);
  if (error) throw error;
}
