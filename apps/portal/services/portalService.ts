import { supabase } from '@/services/supabaseClient';
import type {
  HrEmployee, HrDepartment, HrParkingRegistration, HrParkingVehicleType,
  PayPayrollRecord, PayPayrollSheet, AttMonthlyRecord, AttMonthlySheet,
} from '@/types';

type DirectoryEmployee = Pick<
  HrEmployee,
  'id' | 'full_name' | 'email' | 'work_email' | 'phone' | 'position' | 'avatar_url' | 'status' | 'type' | 'department_id' | 'date_of_birth' | 'address'
>;
type DepartmentLite = Pick<HrDepartment, 'id' | 'name'>;
type PayslipWithSheet = PayPayrollRecord & { sheet?: PayPayrollSheet };
type AttendanceWithSheet = AttMonthlyRecord & { sheet?: AttMonthlySheet };

// Fetch all employees for directory (public info only)
export async function fetchEmployeeDirectory(): Promise<DirectoryEmployee[]> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      id, full_name, email, work_email, phone, position, avatar_url, status, type,
      department_id, date_of_birth, address
    `)
    .eq('status', 'active')
    .in('type', ['fulltime', 'parttime'])
    .order('full_name');
  if (error) throw error;
  return (data as DirectoryEmployee[]) || [];
}

// Fetch departments for mapping
export async function fetchDepartments(): Promise<DepartmentLite[]> {
  const { data, error } = await supabase
    .from('hr_departments')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return (data as DepartmentLite[]) || [];
}

// Fetch my payroll records — from finalized payroll sheets (confirmed or paid).
// Draft is hidden; after HR marks "Đã trả", status becomes paid and must still be visible here.
export async function fetchMyPayslips(employeeId: string): Promise<PayslipWithSheet[]> {
  const { data: visibleSheets } = await supabase
    .from('pay_payroll_sheets')
    .select('id')
    .in('status', ['confirmed', 'paid']);

  if (!visibleSheets || visibleSheets.length === 0) return [];

  const sheetIds = visibleSheets.map(s => s.id);

  // Fetch records only from those sheets
  const { data, error } = await supabase
    .from('pay_payroll_records')
    .select('*, sheet:pay_payroll_sheets(*)')
    .eq('employee_id', employeeId)
    .in('sheet_id', sheetIds)
    .order('created_at', { ascending: false });
  if (error && error.code !== '42P01') throw error;
  return (data as PayslipWithSheet[]) || [];
}

/** Nhân viên xác nhận phiếu lương đúng hoặc báo sai sót. */
export async function submitPayslipAcknowledgement(
  recordId: string,
  status: 'confirmed' | 'disputed',
  comment?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    employee_status: status,
    employee_confirmed_at: new Date().toISOString(),
  };
  if (comment) updates.employee_comment = comment;
  const { error } = await supabase
    .from('pay_payroll_records')
    .update(updates)
    .eq('id', recordId);
  if (error) throw error;
}

/** Kế toán đánh dấu đã giải quyết khiếu nại của nhân viên. */
export async function resolvePayslipDispute(recordId: string): Promise<void> {
  const { error } = await supabase
    .from('pay_payroll_records')
    .update({ employee_status: 'resolved' })
    .eq('id', recordId);
  if (error) throw error;
}

// Fetch my monthly attendance records — only from FINALIZED attendance sheets
export async function fetchMyAttendance(employeeId: string): Promise<AttendanceWithSheet[]> {
  // 1. Get finalized sheet IDs
  const { data: finalizedSheets } = await supabase
    .from('att_monthly_sheets')
    .select('id')
    .eq('status', 'finalized');

  if (!finalizedSheets || finalizedSheets.length === 0) return [];

  const sheetIds = finalizedSheets.map(s => s.id);

  // 2. Fetch records only from finalized sheets
  const { data, error } = await supabase
    .from('att_monthly_records')
    .select('*, sheet:att_monthly_sheets(*)')
    .eq('employee_id', employeeId)
    .in('sheet_id', sheetIds)
    .order('created_at', { ascending: false });
  if (error && error.code !== '42P01') throw error;
  return (data as AttendanceWithSheet[]) || [];
}

// Fetch full profile for the logged-in employee
export async function fetchMyProfile(employeeId: string) {
  const { data, error } = await supabase
    .from('hr_employees')
    .select('*, department:hr_departments!hr_employees_department_id_fkey(*)')
    .eq('id', employeeId)
    .single();
  if (error) throw error;
  return data;
}

// Update profile — only allow employee-editable fields
const EMPLOYEE_EDITABLE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'nationality',
  'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
  'avatar_url', 'id_card_front_url', 'id_card_back_url',
  'tax_code', 'insurance_number',
  'bank_name', 'bank_account', 'bank_branch',
];

/** Đăng ký gửi xe — chỉ 3 trường chính (còn lại để trống / mặc định trong DB). */
export async function fetchMyParkingRegistrations(employeeId: string): Promise<HrParkingRegistration[]> {
  const { data, error } = await supabase
    .from('hr_parking_registrations')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as HrParkingRegistration[];
}

export async function saveMyParkingRegistration(
  employeeId: string,
  row: { vehicle_type: HrParkingVehicleType; license_plate: string; color: string; vehicle_brand?: string },
): Promise<HrParkingRegistration> {
  const { data, error } = await supabase
    .from('hr_parking_registrations')
    .insert({
      employee_id: employeeId,
      vehicle_type: row.vehicle_type,
      license_plate: row.license_plate.trim(),
      color: row.color.trim(),
      vehicle_brand: row.vehicle_brand?.trim() ?? '',
      vehicle_model: '',
      card_number: '',
      parking_area: '',
      registered_at: new Date().toISOString().slice(0, 10),
      effective_from: null,
      effective_to: null,
      status: 'active',
      notes: '',
    })
    .select()
    .single();
  if (error) throw error;
  return data as HrParkingRegistration;
}

export async function updateMyParkingRegistration(
  id: string,
  employeeId: string,
  row: { vehicle_type: HrParkingVehicleType; license_plate: string; color: string; vehicle_brand?: string },
): Promise<void> {
  const { error } = await supabase
    .from('hr_parking_registrations')
    .update({
      vehicle_type: row.vehicle_type,
      license_plate: row.license_plate.trim(),
      color: row.color.trim(),
      vehicle_brand: row.vehicle_brand?.trim() ?? '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('employee_id', employeeId);
  if (error) throw error;
}

export async function deleteMyParkingRegistration(id: string, employeeId: string): Promise<void> {
  const { error } = await supabase
    .from('hr_parking_registrations')
    .delete()
    .eq('id', id)
    .eq('employee_id', employeeId);
  if (error) throw error;
}

export async function updateMyProfile(employeeId: string, updates: Record<string, any>) {
  // Filter to only allow editable fields
  const safeUpdates: Record<string, any> = {};
  for (const key of EMPLOYEE_EDITABLE_FIELDS) {
    if (key in updates) safeUpdates[key] = updates[key];
  }
  safeUpdates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('hr_employees')
    .update(safeUpdates)
    .eq('id', employeeId);
  if (error) throw error;
}
