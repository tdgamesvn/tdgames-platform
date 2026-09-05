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

/** Ngày hiện tại theo giờ VN (YYYY-MM-DD). toISOString() là UTC ⇒ 00:00–06:59 VN rơi sang hôm trước. */
export const todayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export async function checkIn(employeeId: string, method: string = 'manual', shiftId?: string, note?: string): Promise<AttRecord> {
  const today = todayVN();
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

  // Đi muộn / về sớm do trigger `att_records_zz_late_early` tính (migration 20260828140000).
  // Bỏ bản tính ở client: nó chỉ chạy khi có shiftId (thực tế 0/25 bản ghi gắn ca) và dùng
  // `new Date()` theo đồng hồ máy khách — máy lệch timezone là số phút muộn lệch theo.

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

/**
 * Đơn giải trình quên chấm công. Chấm công chặn cứng theo GPS nên đây là lối duy nhất để
 * ngày quên bấm được tính công — và phải qua tay Admin/HR.
 */
export async function submitForgotRequest(
  employeeId: string,
  date: string,
  timeFrom: string | null,
  timeTo: string | null,
  reason: string,
): Promise<AttRequest> {
  const { data, error } = await supabase
    .from('att_requests')
    .insert({
      employee_id: employeeId,
      request_type: 'forgot',
      date_from: date,
      date_to: date,
      time_from: timeFrom,
      time_to: timeTo,
      // Cột leave_type/leave_days có DEFAULT 'annual'/1.0 — bỏ trống là DB tự điền, khiến đơn
      // quên chấm trông y như đơn phép năm 1 ngày. Chính nó kích hoạt trigger trừ phép hôm nay,
      // và còn làm báo cáo phép đếm nhầm. Ghi null cho đúng bản chất.
      leave_type: null,
      leave_days: null,
      reason,
      status: 'pending',
      reviewer_note: '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Duyệt đơn "quên chấm" = ghi giờ vào bảng công luôn, nếu không thì duyệt xong vẫn mất công.
 * Chỉ ghi chiều nào đơn có khai (quên check-out thì check_in thật giữ nguyên).
 * `method: 'manual'` để báo cáo phân biệt được công duyệt tay với công chấm bằng GPS.
 */
async function applyForgotRequest(req: AttRequest): Promise<void> {
  const date = req.date_from;
  const at = (t: string) => new Date(`${date}T${t}`).toISOString();
  const patch: Record<string, unknown> = {};
  if (req.time_from) patch.check_in = at(req.time_from);
  if (req.time_to) patch.check_out = at(req.time_to);
  if (!Object.keys(patch).length) return;

  const { data: existing } = await supabase
    .from('att_records')
    .select('id')
    .eq('employee_id', req.employee_id)
    .eq('date', date)
    .maybeSingle();

  const note = `Giải trình đã duyệt: ${req.reason || '—'}`;
  // Đơn khai cả 2 chiều ⇒ cả ngày công là do duyệt tay, đánh dấu 'manual' để báo cáo phân biệt
  // được với công chấm bằng GPS. Chỉ vá 1 chiều thì giữ method cũ — chiều kia vẫn là GPS thật.
  const bothSides = !!req.time_from && !!req.time_to;
  const { error } = existing
    ? await supabase.from('att_records')
        .update({ ...patch, note, ...(bothSides ? { method: 'manual' } : {}) })
        .eq('id', existing.id)
    : await supabase.from('att_records').insert({
        employee_id: req.employee_id, date, method: 'manual', status: 'present',
        late_minutes: 0, early_minutes: 0, overtime_minutes: 0, note, ...patch,
      });
  if (error) throw error;
}

/**
 * Báo kết quả duyệt cho người gửi đơn. Trước đây duyệt/từ chối xong nhân viên không hề biết —
 * đơn chỉ lặng lẽ biến mất khỏi danh sách chờ.
 * Lỗi gửi thông báo không được làm hỏng việc duyệt, nên nuốt lỗi ở đây.
 */
async function notifyRequestResult(req: AttRequest, approved: boolean, note: string): Promise<void> {
  try {
    const { data: emp } = await supabase
      .from('hr_employees').select('auth_user_id').eq('id', req.employee_id).maybeSingle();
    if (!emp?.auth_user_id) return;
    const label = req.request_type === 'forgot' ? 'Đơn giải trình quên chấm công' : 'Đơn từ';
    await supabase.from('notifications').insert({
      recipient_user_id: emp.auth_user_id,
      type: approved ? 'att_request_approved' : 'att_request_rejected',
      title: approved ? `✅ ${label} đã được duyệt` : `❌ ${label} bị từ chối`,
      body: `Ngày ${req.date_from}${note ? ` — ${note}` : ''}`,
      link: '#portal/tasks',
    });
  } catch (e) {
    console.error('Không gửi được thông báo kết quả duyệt đơn:', e);
  }
}

export async function approveRequest(id: string, approved_by: string, reviewer_note: string = '') {
  const { data: req, error: readErr } = await supabase
    .from('att_requests').select('*').eq('id', id).single();
  if (readErr) throw readErr;

  const { error } = await supabase
    .from('att_requests')
    .update({ status: 'approved', approved_by, approved_at: new Date().toISOString(), reviewer_note })
    .eq('id', id);
  if (error) throw error;

  if (req?.request_type === 'forgot') await applyForgotRequest(req as AttRequest);
  if (req) await notifyRequestResult(req as AttRequest, true, reviewer_note);
}

export async function rejectRequest(id: string, approved_by: string, reviewer_note: string = '') {
  const { data: req } = await supabase.from('att_requests').select('*').eq('id', id).single();
  const { error } = await supabase
    .from('att_requests')
    .update({ status: 'rejected', approved_by, approved_at: new Date().toISOString(), reviewer_note })
    .eq('id', id);
  if (error) throw error;
  if (req) await notifyRequestResult(req as AttRequest, false, reviewer_note);
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

/** Map employee_id → ngày nghỉ việc (YYYY-MM-DD). Thiếu key = chưa nghỉ hoặc không rõ ngày. */
export async function fetchEmployeeEndDates(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('hr_employee_end_dates').select('employee_id, end_date');
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.employee_id, r.end_date]));
}

/**
 * Nhân viên đã nghỉ nhưng ngày nghỉ rơi vào (hoặc sau) tháng này — vẫn phải có dòng
 * trong bảng công để HR nhập công tháng cuối, nếu không là mất lương tháng đó.
 * Ngày nghỉ lấy từ view `hr_employee_end_dates` (suy từ đơn thôi việc đã duyệt).
 * Ai bị sửa tay ô Trạng thái thì không có ngày ⇒ không lấy được, đành chịu.
 */
async function fetchEmployeesLeftDuring(month: number, year: number): Promise<HrEmployee[]> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data: ends } = await supabase
    .from('hr_employee_end_dates')
    .select('employee_id, end_date')
    .gte('end_date', monthStart);
  if (!ends?.length) return [];

  const { data } = await supabase
    .from('hr_employees')
    .select('*')
    .eq('entity', getWorkspace())
    .in('type', ['fulltime', 'parttime'])
    .neq('exclude_from_payroll', true)
    .in('id', ends.map(e => e.employee_id));
  return data || [];
}

export async function createMonthlySheet(
  month: number, year: number, employees: HrEmployee[]
): Promise<{ sheet: AttMonthlySheet; records: AttMonthlyRecord[] }> {
  const title = `Bảng chấm công Tháng ${month}/${year}`;

  // `employees` từ hook đã lọc status='active' ⇒ thiếu người nghỉ giữa tháng. Bù vào đây.
  const leftDuring = await fetchEmployeesLeftDuring(month, year);
  const seen = new Set(employees.map(e => e.id));
  const allEmployees = [...employees, ...leftDuring.filter(e => !seen.has(e.id))];

  // Create the sheet
  const { data: sheet, error: sheetErr } = await supabase
    .from('att_monthly_sheets')
    .insert({ month, year, title, entity: getWorkspace() })
    .select()
    .single();
  if (sheetErr) throw sheetErr;

  // Auto-populate employee records
  const rows = allEmployees.map(e => ({
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

/**
 * Tổng hợp att_records (chấm công hằng ngày) → work_days của bảng công tháng.
 * Công thức nằm trong SQL `att_work_days()` — dùng chung với thông báo Discord,
 * không chép lại ở client để khỏi lệch số. HR vẫn sửa tay đè lên được sau khi tính.
 */
export async function syncMonthWorkDays(
  sheetId: string
): Promise<{ updated: number; missing_checkout: number; holiday_days: number; ot_weekend_updated: number }> {
  const { data, error } = await supabase.rpc('att_sync_month_workdays', { _sheet_id: sheetId });
  if (error) throw error;
  return data as { updated: number; missing_checkout: number; holiday_days: number };
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
  const today = todayVN();
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
  const today = todayVN();
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
 * Bấm giờ ra trên bản ghi hôm nay: `check_out` (mặc định) hoặc 2 cột tăng ca.
 * Vị trí đã được widget chặn trước khi gọi (ngoài bán kính VP thì không cho bấm).
 * ponytail: OT chỉ ghi timestamp — `overtime_minutes` vẫn do HR chốt tay theo tháng,
 * nên bấm nhầm không đụng vào lương; Discord có thông báo để quản lý theo dõi.
 */
export async function selfCheckOut(
  recordId: string,
  field: 'check_out' | 'ot_check_in' | 'ot_check_out' = 'check_out'
): Promise<AttRecord> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_records')
    .update({ [field]: now })
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
/**
 * Trạng thái đơn WFH phủ ngày `date`: 'approved' | 'pending' | null (không có đơn).
 * Trả status thay vì boolean để widget phân biệt "chưa có đơn" với "đơn chờ duyệt" —
 * cùng 1 query, không thêm round-trip.
 */
export async function fetchRemoteStatus(
  employeeId: string,
  date: string
): Promise<'approved' | 'pending' | null> {
  const { data, error } = await supabase
    .from('att_requests')
    .select('status')
    .eq('employee_id', employeeId)
    .eq('request_type', 'leave')
    .eq('leave_type', 'remote')
    .in('status', ['approved', 'pending'])
    .lte('date_from', date)
    .gte('date_to', date)
    // Có cả 2 đơn phủ cùng ngày thì 'approved' phải thắng — sort chữ cái đặt nó trước 'pending'.
    .order('status', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as 'approved' | 'pending') ?? null;
}

// ══════════════════════════════════════════════════════════
// ── Ngày nghỉ lễ (HR nhập tay) ────────────────────────────
// ══════════════════════════════════════════════════════════

export interface AttHoliday {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  kind: 'holiday' | 'makeup' | 'ot'; // holiday: nghỉ lễ · makeup: làm bù (tính như ngày thường) · ot: lịch OT
  created_at?: string;
}

export async function fetchHolidays(): Promise<AttHoliday[]> {
  const { data, error } = await supabase
    .from('att_holidays')
    .select('*')
    .order('date_from', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveHoliday(name: string, dateFrom: string, dateTo: string, kind: AttHoliday['kind'] = 'holiday'): Promise<AttHoliday> {
  const { data, error } = await supabase
    .from('att_holidays')
    .insert({ name, date_from: dateFrom, date_to: dateTo, kind })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await supabase.from('att_holidays').delete().eq('id', id);
  if (error) throw error;
}

/** HR gửi yêu cầu NV xác nhận bảng công (notification cho từng người). Trả về số NV được báo. */
export async function requestSheetConfirm(sheetId: string): Promise<number> {
  const { data, error } = await supabase.rpc('att_request_sheet_confirm', { _sheet_id: sheetId });
  if (error) throw error;
  return (data as number) || 0;
}
