import { getWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';
import {
  AttShift, AttEmployeeShift, AttRecord, AttRequest, AttQrSession,
  AttMonthlySheet, AttMonthlyRecord, HrEmployee, AttOfficeConfig,
} from '@/types';

// ══════════════════════════════════════════════════════════
// ── Shifts ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchShifts(): Promise<AttShift[]> {
  const { data, error } = await supabase
    .from('att_shifts')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveShift(shift: Omit<AttShift, 'id' | 'created_at'>): Promise<AttShift> {
  const { data, error } = await supabase
    .from('att_shifts')
    .insert({ entity: getWorkspace(), ...shift })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShift(id: string, updates: Partial<AttShift>) {
  const { error } = await supabase.from('att_shifts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteShift(id: string) {
  const { error } = await supabase.from('att_shifts').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Employee Shifts (Phân ca) ─────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchEmployeeShifts(): Promise<AttEmployeeShift[]> {
  const { data, error } = await supabase
    .from('att_employee_shifts')
    .select('*, shift:att_shifts(*), employee:hr_employees(*)')
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveEmployeeShift(es: Omit<AttEmployeeShift, 'id' | 'created_at' | 'shift' | 'employee'>): Promise<AttEmployeeShift> {
  const { data, error } = await supabase
    .from('att_employee_shifts')
    .insert(es)
    .select('*, shift:att_shifts(*), employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEmployeeShift(id: string) {
  const { error } = await supabase.from('att_employee_shifts').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Attendance Records ────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchRecords(filters?: { date?: string; employeeId?: string }): Promise<AttRecord[]> {
  let q = supabase
    .from('att_records')
    .select('*, employee:hr_employees(*), shift:att_shifts(*)')
    .order('date', { ascending: false });
  if (filters?.date) q = q.eq('date', filters.date);
  if (filters?.employeeId) q = q.eq('employee_id', filters.employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchRecordsByRange(from: string, to: string): Promise<AttRecord[]> {
  const { data, error } = await supabase
    .from('att_records')
    .select('*, employee:hr_employees(*), shift:att_shifts(*)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function checkIn(employeeId: string, method: string = 'manual', shiftId?: string, note?: string): Promise<AttRecord> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Check if record exists for today
  const { data: existing } = await supabase
    .from('att_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    // Already checked in — do check-out instead
    const { data, error } = await supabase
      .from('att_records')
      .update({ check_out: now })
      .eq('id', existing.id)
      .select('*, employee:hr_employees(*), shift:att_shifts(*)')
      .single();
    if (error) throw error;
    return data;
  }

  // New check-in
  const record: any = {
    employee_id: employeeId,
    date: today,
    check_in: now,
    method,
    shift_id: shiftId || null,
    note: note || '',
  };

  // Calculate late status if shift provided
  if (shiftId) {
    const { data: shift } = await supabase.from('att_shifts').select('*').eq('id', shiftId).single();
    if (shift) {
      const [sh, sm] = shift.start_time.split(':').map(Number);
      const checkInTime = new Date(now);
      const scheduledStart = new Date(now);
      scheduledStart.setHours(sh, sm, 0, 0);
      const diffMins = Math.round((checkInTime.getTime() - scheduledStart.getTime()) / 60000);
      if (diffMins > (shift.late_threshold_minutes || 15)) {
        record.status = 'late';
        record.late_minutes = diffMins;
      }
    }
  }

  const { data, error } = await supabase
    .from('att_records')
    .insert(record)
    .select('*, employee:hr_employees(*), shift:att_shifts(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecord(id: string, updates: Partial<AttRecord>) {
  const { error } = await supabase.from('att_records').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteRecord(id: string) {
  const { error } = await supabase.from('att_records').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Requests ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchRequests(status?: string): Promise<AttRequest[]> {
  let q = supabase
    .from('att_requests')
    .select('*, employee:hr_employees(*)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveRequest(req: Omit<AttRequest, 'id' | 'created_at' | 'approved_at' | 'employee'>): Promise<AttRequest> {
  const { data, error } = await supabase
    .from('att_requests')
    .insert(req)
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function approveRequest(id: string, approved_by: string, reviewer_note: string = '') {
  const { error } = await supabase
    .from('att_requests')
    .update({ status: 'approved', approved_by, approved_at: new Date().toISOString(), reviewer_note })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectRequest(id: string, approved_by: string, reviewer_note: string = '') {
  const { error } = await supabase
    .from('att_requests')
    .update({ status: 'rejected', approved_by, approved_at: new Date().toISOString(), reviewer_note })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteRequest(id: string) {
  const { error } = await supabase.from('att_requests').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── QR Sessions ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchQrSessions(): Promise<AttQrSession[]> {
  const { data, error } = await supabase
    .from('att_qr_sessions')
    .select('*, shift:att_shifts(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createQrSession(session: Omit<AttQrSession, 'id' | 'created_at' | 'shift'>): Promise<AttQrSession> {
  const { data, error } = await supabase
    .from('att_qr_sessions')
    .insert(session)
    .select('*, shift:att_shifts(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function validateQrToken(token: string): Promise<AttQrSession | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_qr_sessions')
    .select('*, shift:att_shifts(*)')
    .eq('token', token)
    .lte('valid_from', now)
    .gte('valid_to', now)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════
// ── Monthly Sheets (Bảng chấm công tháng) ─────────────────
// ══════════════════════════════════════════════════════════

export async function fetchMonthlySheets(): Promise<AttMonthlySheet[]> {
  const { data, error } = await supabase
    .from('att_monthly_sheets')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createMonthlySheet(
  month: number, year: number, employees: HrEmployee[]
): Promise<{ sheet: AttMonthlySheet; records: AttMonthlyRecord[] }> {
  const title = `Bảng chấm công Tháng ${month}/${year}`;

  // Create the sheet
  const { data: sheet, error: sheetErr } = await supabase
    .from('att_monthly_sheets')
    .insert({ month, year, title, entity: getWorkspace() })
    .select()
    .single();
  if (sheetErr) throw sheetErr;

  // Auto-populate employee records
  const rows = employees.map(e => ({
    sheet_id: sheet.id,
    employee_id: e.id,
    work_days: 0,
    ot_hours: 0,
    ot_hours_weekend: 0,
    ot_hours_holiday: 0,
    ot_hours_night: 0,
    ot_hours_night_weekend: 0,
    ot_hours_night_holiday: 0,
    late_count: 0,
    absent_days: 0,
    note: '',
  }));

  const { data: records, error: recErr } = await supabase
    .from('att_monthly_records')
    .insert(rows)
    .select('*, employee:hr_employees(*)');
  if (recErr) throw recErr;

  return { sheet, records: records || [] };
}

export async function fetchMonthlyRecords(sheetId: string): Promise<AttMonthlyRecord[]> {
  const { data, error } = await supabase
    .from('att_monthly_records')
    .select('*, employee:hr_employees(*)')
    .eq('sheet_id', sheetId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function updateMonthlyRecord(id: string, updates: Partial<AttMonthlyRecord>) {
  const { error } = await supabase.from('att_monthly_records').update(updates).eq('id', id);
  if (error) throw error;
}

export async function updateMonthlySheet(id: string, updates: Partial<AttMonthlySheet>) {
  const { error } = await supabase.from('att_monthly_sheets').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteMonthlySheet(id: string) {
  const { error } = await supabase.from('att_monthly_sheets').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Geo Check-in Self-Service ─────────────────────────────
// ══════════════════════════════════════════════════════════

/**
 * Haversine distance between two GPS points. Returns meters.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fetch the single office geofence config row. */
export async function fetchOfficeConfig(): Promise<AttOfficeConfig> {
  const { data, error } = await supabase
    .from('att_office_config')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

/** Update office config (admin only — enforced by RLS). */
export async function updateOfficeConfig(
  id: string,
  updates: Partial<Omit<AttOfficeConfig, 'id' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('att_office_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Fetch today's att_record for the given employee (null if not checked in yet). */
export async function fetchMyTodayRecord(
  employeeId: string
): Promise<AttRecord | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('att_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Fetch daily att_records in a date range for an employee (for history view). */
export async function fetchMyRecordsByRange(
  employeeId: string,
  from: string,
  to: string
): Promise<AttRecord[]> {
  const { data, error } = await supabase
    .from('att_records')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Self check-in: insert a new att_record for today.
 * method = 'geo' for office check-in, 'remote' for approved WFH day.
 * GPS coords are stored for audit (geo only).
 */
export async function selfCheckIn(
  employeeId: string,
  lat: number,
  lng: number,
  method: 'geo' | 'remote'
): Promise<AttRecord> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_records')
    .insert({
      employee_id: employeeId,
      date: today,
      check_in: now,
      method,
      check_in_lat: method === 'geo' ? lat : null,
      check_in_lng: method === 'geo' ? lng : null,
      status: 'present',
      late_minutes: 0,
      early_minutes: 0,
      overtime_minutes: 0,
      note: '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Self check-out: set check_out timestamp on an existing att_record.
 * Vị trí đã được widget chặn trước khi gọi (ngoài bán kính VP thì không cho check-out).
 */
export async function selfCheckOut(
  recordId: string
): Promise<AttRecord> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_records')
    .update({ check_out: now })
    .eq('id', recordId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Check if employee has an approved remote leave request covering today.
 * Used to bypass geofence on WFH days.
 */
export async function checkRemoteApproved(
  employeeId: string,
  date: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('att_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('request_type', 'leave')
    .eq('leave_type', 'remote')
    .eq('status', 'approved')
    .lte('date_from', date)
    .gte('date_to', date)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
