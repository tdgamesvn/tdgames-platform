import { supabase } from '@/services/supabaseClient';
import {
  PayPayrollSheet, PayPayrollRecord,
  HrEmployee, HrEmployeeSalary,
  PayrollFormulaConfig,
} from '@/types';
import {
  FALLBACK_PAYROLL_FORMULA,
  fetchPayrollFormulaForMonth,
  fetchPayrollFormulaById,
} from './payrollFormulaService';
import { countWeekdays } from '../utils/workdayUtils';

// ══════════════════════════════════════════════════════════
// ── Core: calculatePayroll (pure function, 8 steps) ──────
// ══════════════════════════════════════════════════════════

interface PayrollInput {
  workDays: number;
  baseSalary: number;
  lunchAllowance: number;
  transportAllowance: number;
  phoneAllowance: number;
  clothingAllowance: number;
  kpiAllowance: number;
  defaultOt: number;
  extraOtHours: number;
  dependentsCount: number;
  isProbation: boolean;
  /** Tỷ lệ ngày thử việc trong tháng. 0 = full official, 1 = full probation, 0<x<1 = transition month (lên chính thức giữa tháng) */
  probationRatio?: number;
  /** Thưởng KPI nhập tay — tính vào thu nhập chịu thuế TNCN (TT 111/2013) */
  bonus?: number;
}

interface PayrollOutput {
  grossRef: number;
  grossActual: number;
  extraOt: number;
  employeeBhxh: number;
  taxableIncome: number;
  assessableIncome: number;
  pit: number;
  netSalary: number;
  companyBhxh: number;
  totalCompanyCost: number;
}

export function calculatePayroll(
  input: PayrollInput,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
  /** Override ngày công tiêu chuẩn — ưu tiên hơn formula.standardWorkDays (dùng giá trị tính động T2-T6 của tháng). */
  standardWorkDays?: number,
): PayrollOutput {
  const r = (v: number) => Math.round(v);
  const std = standardWorkDays ?? formula.standardWorkDays;
  const hpd = formula.hoursPerDay;

  const ratio = input.workDays / std;
  // probation_ratio: 0 = full official, 1 = full probation, 0<x<1 = tháng chuyển giao
  // Fallback: nếu không cung cấp, suy ra từ isProbation (giữ tương thích ngược)
  const probRatio = Math.max(0, Math.min(1, input.probationRatio ?? (input.isProbation ? 1 : 0)));
  const officialRatio = 1 - probRatio;

  const baseSalaryActual = r(input.baseSalary * ratio);
  const lunchActual = r(input.lunchAllowance * ratio);
  const transportActual = r(input.transportAllowance * ratio);
  const phoneActual = r(input.phoneAllowance * ratio);
  const clothingActual = r(input.clothingAllowance * ratio);
  const kpiActual = r(input.kpiAllowance * ratio);
  const defaultOtActual = r(input.defaultOt * ratio);

  const hourlyRate = input.baseSalary / std / hpd;
  const extraOt = r(hourlyRate * formula.otRateWeekday * input.extraOtHours);
  const bonusAmount = input.bonus ?? 0;

  const grossRef = r(input.baseSalary + input.lunchAllowance + input.transportAllowance
    + input.phoneAllowance + input.clothingAllowance + input.kpiAllowance + input.defaultOt);

  // Lương 100% — không phụ thuộc probation/official (per company policy)
  // Bonus tính vào gross thực tế (cộng toàn bộ, không prorate)
  const grossActual = baseSalaryActual + lunchActual + transportActual
    + phoneActual + clothingActual + kpiActual + defaultOtActual + extraOt + bonusAmount;

  // BHXH: chỉ tính trên phần ngày chính thức trong tháng
  const employeeBhxh = r(input.baseSalary * formula.bhEmployeeRate * officialRatio);
  const companyBhxh = r(input.baseSalary * formula.bhCompanyRate * officialRatio);

  // Thu nhập chịu thuế (không bao gồm lunch, clothing, OT)
  // Bonus (tiền thưởng từ HĐLĐ) tính vào TNCT theo TT 111/2013
  const taxableIncome = baseSalaryActual + transportActual + phoneActual + kpiActual + bonusAmount;

  // PIT phần thử việc: 10% flat trên phần thu nhập tương ứng số ngày probation
  const taxableProbation = r(taxableIncome * probRatio);
  const pitProbation = r(taxableProbation * formula.probationPitRate);

  // PIT phần chính thức: lũy tiến trên (phần thu nhập official - BHXH - giảm trừ)
  // Giảm trừ gia cảnh full mức/tháng (TT 111/2013) dù chỉ có vài ngày official
  const taxableOfficial = taxableIncome - taxableProbation;
  let assessableIncome = taxableOfficial - employeeBhxh
    - formula.personalDeduction
    - (input.dependentsCount * formula.dependentDeduction);
  if (assessableIncome < 0) assessableIncome = 0;

  let pitOfficial = 0;
  if (assessableIncome > 0) {
    for (const bracket of formula.taxBrackets) {
      if (assessableIncome <= bracket.limit) {
        pitOfficial = r(assessableIncome * bracket.rate - bracket.deduction);
        break;
      }
    }
  }

  const pit = pitProbation + pitOfficial;
  const netSalary = grossActual - employeeBhxh - pit;
  const totalCompanyCost = grossActual + companyBhxh;

  return {
    grossRef, grossActual, extraOt,
    employeeBhxh, taxableIncome, assessableIncome,
    pit, netSalary, companyBhxh, totalCompanyCost,
  };
}

// ══════════════════════════════════════════════════════════
// ── CRUD: Payroll Sheets ─────────────────────────────────
// ══════════════════════════════════════════════════════════

/** Công thức gắn với bảng lương (theo formula_settings_id, hoặc theo kỳ tháng/năm). */
export async function resolveFormulaForSheet(sheet: PayPayrollSheet): Promise<PayrollFormulaConfig> {
  if (sheet.formula_settings_id) {
    const got = await fetchPayrollFormulaById(sheet.formula_settings_id);
    if (got) return got.config;
  }
  const { config } = await fetchPayrollFormulaForMonth(sheet.month, sheet.year);
  return config;
}

export async function fetchPayrollSheets(): Promise<PayPayrollSheet[]> {
  const { data, error } = await supabase
    .from('pay_payroll_sheets')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deletePayrollSheet(id: string): Promise<void> {
  const { error } = await supabase.from('pay_payroll_sheets').delete().eq('id', id);
  if (error) throw error;
}

export type PayrollStatusActor = {
  userId: string | null;
  setConfirmedBy?: boolean;
  setPaidBy?: boolean;
};

export async function updateSheetStatus(
  id: string,
  status: PayPayrollSheet['status'],
  actor?: PayrollStatusActor,
): Promise<PayPayrollSheet> {
  const row: Record<string, unknown> = { status };
  if (actor?.setConfirmedBy && actor.userId) row.confirmed_by = actor.userId;
  if (actor?.setPaidBy && actor.userId) row.paid_by = actor.userId;
  const { data, error } = await supabase
    .from('pay_payroll_sheets')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PayPayrollSheet;
}

// ══════════════════════════════════════════════════════════
// ── CRUD: Payroll Records ────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchPayrollRecords(sheetId: string): Promise<PayPayrollRecord[]> {
  const { data, error } = await supabase
    .from('pay_payroll_records')
    .select('*, employee:hr_employees(*)')
    .eq('sheet_id', sheetId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function updatePayrollRecord(id: string, updates: Partial<PayPayrollRecord>): Promise<void> {
  const { employee, ...clean } = updates as any;
  const { error } = await supabase.from('pay_payroll_records').update(clean).eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Create Payroll Sheet (auto-populate from HR + Att) ───
// ══════════════════════════════════════════════════════════

// Map salary component names → record field
const SALARY_NAME_MAP: Record<string, keyof PayPayrollRecord> = {
  'Lương cơ bản': 'base_salary',
  'Phụ cấp ăn trưa': 'lunch_allowance',
  'Phụ cấp xăng xe': 'transport_allowance',
  'Phụ cấp điện thoại': 'phone_allowance',
  'Phụ cấp trang phục': 'clothing_allowance',
  'Phụ cấp năng suất (KPI)': 'kpi_allowance',
  'Tăng ca': 'default_ot',
};

export async function createPayrollSheet(
  month: number, year: number
): Promise<{ sheet: PayPayrollSheet; records: PayPayrollRecord[] }> {
  const { settings: formulaRow, config: formulaConfig } = await fetchPayrollFormulaForMonth(month, year);

  // Tính số ngày T2-T6 thực tế của tháng (có thể là 21, 22, hoặc 23)
  const stdDays = countWeekdays(year, month);

  const title = `Bảng lương Tháng ${month}/${year}`;
  const insertSheet: Record<string, unknown> = { month, year, title, standard_work_days: stdDays };
  if (formulaRow?.id) insertSheet.formula_settings_id = formulaRow.id;

  const { data: sheet, error: sheetErr } = await supabase
    .from('pay_payroll_sheets')
    .insert(insertSheet)
    .select()
    .single();
  if (sheetErr) throw sheetErr;

  // 2. Fetch all fulltime employees
  const { data: employees } = await supabase
    .from('hr_employees')
    .select('*')
    .eq('type', 'fulltime')
    .eq('status', 'active');

  if (!employees?.length) return { sheet, records: [] };

  // 3. Fetch employee salary data
  const { data: salaryRows } = await supabase
    .from('hr_employee_salary')
    .select('*, component:hr_salary_components(name)')
    .in('employee_id', employees.map(e => e.id));

  // 4. Fetch monthly sheet records (attendance) for this month
  const { data: attSheets } = await supabase
    .from('att_monthly_sheets')
    .select('id')
    .eq('month', month)
    .eq('year', year);

  let attRecords: any[] = [];
  if (attSheets?.length) {
    const { data } = await supabase
      .from('att_monthly_records')
      .select('*')
      .eq('sheet_id', attSheets[0].id);
    attRecords = data || [];
  }

  // 5. Fetch dependents count per employee
  const { data: dependents } = await supabase
    .from('hr_dependents')
    .select('employee_id')
    .eq('status', 'active')
    .in('employee_id', employees.map(e => e.id));

  const depCountMap: Record<string, number> = {};
  (dependents || []).forEach(d => {
    depCountMap[d.employee_id] = (depCountMap[d.employee_id] || 0) + 1;
  });

  // 6. Build records
  // Determine month boundaries for probation_ratio computation
  const payrollFirstDay = new Date(year, month - 1, 1); // first day of this month
  const payrollLastDay = new Date(year, month, 0);      // last day of this month
  const totalDaysInMonth = payrollLastDay.getDate();

  const rows = employees.map(emp => {
    // Salary components for this employee
    const empSalary = (salaryRows || []).filter(s => s.employee_id === emp.id);
    const salaryMap: Record<string, number> = {};
    empSalary.forEach(s => {
      const compName = s.component?.name || '';
      const field = SALARY_NAME_MAP[compName];
      if (field) salaryMap[field] = s.amount || 0;
    });

    // Attendance data
    const attRec = attRecords.find(r => r.employee_id === emp.id);
    // Fallback: dùng stdDays (T2-T6 thực tế) thay vì formulaConfig.standardWorkDays cố định
    const workDays = attRec?.work_days ?? stdDays;
    const extraOtHours = attRec?.ot_hours ?? 0;

    // ── Probation ratio computation ─────────────────────────
    // Ưu tiên official_date (ngày lên chính thức). Fallback về probation_end + 1 nếu chưa có.
    const officialRaw = (emp as any).official_date
      || (emp.probation_end ? new Date(new Date(emp.probation_end).getTime() + 24 * 3600 * 1000).toISOString().split('T')[0] : null);
    const officialDate = officialRaw ? new Date(officialRaw) : null;

    let probationRatio = 0;
    if (!officialDate || officialDate > payrollLastDay) {
      // Cả tháng còn thử việc
      probationRatio = 1;
    } else if (officialDate <= payrollFirstDay) {
      // Cả tháng đã chính thức
      probationRatio = 0;
    } else {
      // Tháng chuyển giao: official_date rơi giữa tháng
      const daysProbation = officialDate.getDate() - 1; // ngày 1 → ngày trước official_date
      probationRatio = daysProbation / totalDaysInMonth;
    }
    const isProbation = probationRatio === 1;

    const input: PayrollInput = {
      workDays,
      baseSalary: salaryMap.base_salary || 0,
      lunchAllowance: salaryMap.lunch_allowance || 0,
      transportAllowance: salaryMap.transport_allowance || 0,
      phoneAllowance: salaryMap.phone_allowance || 0,
      clothingAllowance: salaryMap.clothing_allowance || 0,
      kpiAllowance: salaryMap.kpi_allowance || 0,
      defaultOt: salaryMap.default_ot || 0,
      extraOtHours,
      dependentsCount: depCountMap[emp.id] || 0,
      isProbation,
      probationRatio,
      bonus: 0,
    };

    const output = calculatePayroll(input, formulaConfig, stdDays);

    return {
      sheet_id: sheet.id,
      employee_id: emp.id,
      work_days: input.workDays,
      base_salary: input.baseSalary,
      lunch_allowance: input.lunchAllowance,
      transport_allowance: input.transportAllowance,
      phone_allowance: input.phoneAllowance,
      clothing_allowance: input.clothingAllowance,
      kpi_allowance: input.kpiAllowance,
      default_ot: input.defaultOt,
      extra_ot_hours: input.extraOtHours,
      extra_ot: output.extraOt,
      dependents_count: input.dependentsCount,
      is_probation: isProbation,
      probation_ratio: probationRatio,
      bonus: 0,
      gross_ref: output.grossRef,
      gross_actual: output.grossActual,
      employee_bhxh: output.employeeBhxh,
      taxable_income: output.taxableIncome,
      assessable_income: output.assessableIncome,
      pit: output.pit,
      net_salary: output.netSalary,
      company_bhxh: output.companyBhxh,
      total_company_cost: output.totalCompanyCost,
    };
  });

  const { data: records, error: recErr } = await supabase
    .from('pay_payroll_records')
    .insert(rows)
    .select('*, employee:hr_employees(*)');
  if (recErr) throw recErr;

  return { sheet, records: records || [] };
}

// ══════════════════════════════════════════════════════════
// ── Recalculate ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export function recalculateRecord(
  rec: PayPayrollRecord,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
  /** Ngày công tiêu chuẩn của bảng lương — lấy từ sheet.standard_work_days (T2-T6 thực tế tháng đó). Fallback về formula.standardWorkDays nếu null (bảng lương cũ). */
  standardWorkDays?: number | null,
): PayPayrollRecord {
  const input: PayrollInput = {
    workDays: rec.work_days,
    baseSalary: rec.base_salary,
    lunchAllowance: rec.lunch_allowance,
    transportAllowance: rec.transport_allowance,
    phoneAllowance: rec.phone_allowance,
    clothingAllowance: rec.clothing_allowance,
    kpiAllowance: rec.kpi_allowance,
    defaultOt: rec.default_ot,
    extraOtHours: rec.extra_ot_hours,
    dependentsCount: rec.dependents_count,
    isProbation: rec.is_probation ?? false,
    probationRatio: rec.probation_ratio ?? (rec.is_probation ? 1 : 0),
    // Bonus tính vào TNCT → PIT tự tăng theo bậc lũy tiến
    bonus: rec.bonus ?? 0,
  };
  const output = calculatePayroll(input, formula, standardWorkDays ?? undefined);
  return {
    ...rec,
    extra_ot: output.extraOt,
    gross_ref: output.grossRef,
    gross_actual: output.grossActual,
    employee_bhxh: output.employeeBhxh,
    taxable_income: output.taxableIncome,
    assessable_income: output.assessableIncome,
    pit: output.pit,
    net_salary: output.netSalary,
    company_bhxh: output.companyBhxh,
    total_company_cost: output.totalCompanyCost,
  };
}

export async function recalculateAndSave(
  rec: PayPayrollRecord,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
  standardWorkDays?: number | null,
): Promise<PayPayrollRecord> {
  const updated = recalculateRecord(rec, formula, standardWorkDays);
  const { employee, ...clean } = updated as any;
  await updatePayrollRecord(updated.id, clean);
  return updated;
}
