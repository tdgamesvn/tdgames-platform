import { supabase } from '@/services/supabaseClient';
import { LeaveBalance, AttRequest, HrEmployee } from '@/types';

// ══════════════════════════════════════════════════════════
// ── Leave Balance Calculation (YEARLY) ────────────────────
// ══════════════════════════════════════════════════════════

/**
 * Calculate how many leave days an employee accrues in a given year.
 * Rules:
 * - Only fulltime employees after probation get annual leave
 * - 1 month worked (after official date) = 1 leave day
 * - Accumulates for the entire year
 * - Unused days at year end carry over to Q1 of next year only
 * - If not used by end of Q1 next year, they expire
 *
 * Example: Official from April 2026 → Apr-Dec = 9 months = 9 days for 2026
 */
export function calculateYearlyAccrual(
  employee: HrEmployee,
  year: number
): number {
  if (employee.type !== 'fulltime' || employee.status !== 'active') return 0;

  const officialStart = employee.probation_end || employee.start_date;
  if (!officialStart) return 0;

  const officialDate = new Date(officialStart);

  let accrued = 0;
  for (let m = 1; m <= 12; m++) {
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd = new Date(year, m, 0);

    // Employee must have been official for the entire month (or most of it)
    if (officialDate <= monthStart) {
      accrued += 1; // Full month worked
    } else if (officialDate <= monthEnd) {
      // Partial month — started before the 15th = count 0.5
      if (officialDate.getDate() <= 15) {
        accrued += 0.5;
      }
    }
  }
  return accrued;
}

/**
 * Get current quarter from a date
 */
export function getCurrentQuarter(date: Date = new Date()): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

// ══════════════════════════════════════════════════════════
// ── Balance CRUD ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchLeaveBalances(employeeId: string, year?: number): Promise<LeaveBalance[]> {
  let q = supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .order('year', { ascending: false })
    .order('quarter', { ascending: true });
  if (year) q = q.eq('year', year);
  const { data, error } = await q;
  if (error && error.code !== '42P01') throw error;
  return data || [];
}

export async function upsertLeaveBalance(
  employeeId: string,
  year: number,
  quarter: number,
  accrued_days: number
): Promise<LeaveBalance> {
  const { data, error } = await supabase
    .from('leave_balances')
    .upsert(
      { employee_id: employeeId, year, quarter, accrued_days },
      { onConflict: 'employee_id,year,quarter' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Ensure balance records exist for the given year.
 * Uses quarter=0 for the main yearly accrual.
 * Uses quarter=1 for carry-over from previous year (available only in Q1).
 */
export async function ensureBalancesForYear(employee: HrEmployee, year: number): Promise<{
  yearlyBalance: LeaveBalance | null;
  carryOverBalance: LeaveBalance | null;
}> {
  // Yearly accrual (quarter=0)
  const existingYearly = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', year)
    .eq('quarter', 0)
    .maybeSingle();

  let yearlyBalance: LeaveBalance | null = existingYearly.data;
  if (!yearlyBalance) {
    const accrued = calculateYearlyAccrual(employee, year);
    if (accrued > 0) {
      yearlyBalance = await upsertLeaveBalance(employee.id, year, 0, accrued);
    }
  }

  // Carry-over from previous year (quarter=1)
  // Only relevant if we're in Q1 of the current year
  const existingCarryOver = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('year', year)
    .eq('quarter', 1)
    .maybeSingle();

  let carryOverBalance: LeaveBalance | null = existingCarryOver.data;

  // If no carry-over record exists, check previous year for leftover
  if (!carryOverBalance) {
    const prevYearly = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('year', year - 1)
      .eq('quarter', 0)
      .maybeSingle();

    if (prevYearly.data) {
      const prev = prevYearly.data;
      const leftover = Math.max(0, Number(prev.accrued_days || 0) - Number(prev.used_days || 0));
      if (leftover > 0) {
        carryOverBalance = await upsertLeaveBalance(employee.id, year, 1, leftover);
      }
    }
  }

  return { yearlyBalance, carryOverBalance };
}

/**
 * Get the available leave days for the employee right now.
 *
 * - yearlyAccrued: total days accrued this year
 * - yearlyUsed: days used from this year's balance
 * - yearlyAvailable: yearlyAccrued - yearlyUsed
 * - carryOver: days carried from previous year (only in Q1)
 * - carryOverUsed: days used from carry-over
 * - carryOverAvailable: 0 if past Q1, otherwise carryOver - carryOverUsed
 * - totalAvailable: yearlyAvailable + carryOverAvailable
 */
export function getAvailableLeaveDays(
  yearlyBalance: LeaveBalance | null,
  carryOverBalance: LeaveBalance | null,
  currentQuarter: number
): {
  yearlyAccrued: number;
  yearlyUsed: number;
  yearlyAvailable: number;
  carryOver: number;
  carryOverUsed: number;
  carryOverAvailable: number;
  carryOverExpired: boolean;
  totalAvailable: number;
} {
  const yearlyAccrued = Number(yearlyBalance?.accrued_days || 0);
  const yearlyUsed = Number(yearlyBalance?.used_days || 0);
  const yearlyAvailable = Math.max(0, yearlyAccrued - yearlyUsed);

  const carryOver = Number(carryOverBalance?.accrued_days || 0);
  const carryOverUsed = Number(carryOverBalance?.used_days || 0);
  // Carry-over only available during Q1
  const carryOverExpired = currentQuarter > 1;
  const carryOverAvailable = carryOverExpired ? 0 : Math.max(0, carryOver - carryOverUsed);

  return {
    yearlyAccrued,
    yearlyUsed,
    yearlyAvailable,
    carryOver,
    carryOverUsed,
    carryOverAvailable,
    carryOverExpired,
    totalAvailable: yearlyAvailable + carryOverAvailable,
  };
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
  leaveType: 'annual' | 'unpaid' | 'sick' | 'birthday' | 'remote',
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
  // Get the request info first
  const { data: req, error: fetchErr } = await supabase
    .from('att_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (fetchErr) throw fetchErr;

  // Update request status
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

  // Deduct from yearly balance (only for annual leave)
  if (req.leave_type === 'annual') {
    const reqDate = new Date(req.date_from);
    const year = reqDate.getFullYear();
    const leaveDays = Number(req.leave_days || 1);

    // Try to use carry-over first (if in Q1), then yearly balance
    const quarter = getCurrentQuarter(reqDate);
    let remaining = leaveDays;

    if (quarter === 1) {
      // Check carry-over balance first
      const { data: carryOver } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', req.employee_id)
        .eq('year', year)
        .eq('quarter', 1)
        .maybeSingle();

      if (carryOver) {
        const coAvailable = Math.max(0, Number(carryOver.accrued_days || 0) - Number(carryOver.used_days || 0));
        const useFromCO = Math.min(remaining, coAvailable);
        if (useFromCO > 0) {
          await supabase
            .from('leave_balances')
            .update({ used_days: Number(carryOver.used_days || 0) + useFromCO })
            .eq('id', carryOver.id);
          remaining -= useFromCO;
        }
      }
    }

    // Use remaining from yearly balance
    if (remaining > 0) {
      const { data: yearly } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', req.employee_id)
        .eq('year', year)
        .eq('quarter', 0)
        .maybeSingle();

      if (yearly) {
        await supabase
          .from('leave_balances')
          .update({ used_days: Number(yearly.used_days || 0) + remaining })
          .eq('id', yearly.id);
      }
    }
  }
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
