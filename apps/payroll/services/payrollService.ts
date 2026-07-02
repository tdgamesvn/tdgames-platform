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
import { countWeekdays, countWeekdaysFromDate } from '../utils/workdayUtils';

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
  /** Lương CB trước khi lên chính thức. Nếu có và tháng chuyển giao → prorate giữa 2 mức. */
  preOfficialBaseSalary?: number | null;
  /** Thưởng KPI nhập tay — tính vào thu nhập chịu thuế TNCN (TT 111/2013) */
  bonus?: number;
  /** Miễn BHXH: ngày làm việc chính thức trong tháng < 14 ngày (Luật BHXH VN, TT 59/2015).
   *  - true → BHXH = 0 (cả NV lẫn công ty)
   *  - false/undefined → đóng full BHXH (all-or-nothing, không prorate theo officialRatio) */
  bhxhExempt?: boolean;
  /** Mức lương đóng BHXH (nếu khác baseSalary). Dùng cho GrossNetCalculator khi user muốn tách riêng mức đóng BHXH.
   *  - undefined/null → dùng baseSalary làm mức đóng BHXH (mặc định) */
  bhxhBaseSalary?: number | null;
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

  // Tháng chuyển giao + tăng lương: prorate giữa lương cũ (probation) và lương mới (official)
  const hasPreOfficialSalary = input.preOfficialBaseSalary != null && probRatio > 0 && probRatio < 1;
  const effectiveBaseSalary = hasPreOfficialSalary
    ? r(input.preOfficialBaseSalary! * probRatio + input.baseSalary * officialRatio)
    : input.baseSalary;
  const baseSalaryActual = r(effectiveBaseSalary * ratio);
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

  // BHXH: all-or-nothing theo luật BHXH Việt Nam (TT 59/2015/TT-BLĐTBXH)
  // - Miễn (bhxhExempt=true): full probation HOẶC ngày làm việc chính thức < 14 ngày trong tháng
  // - Đóng full (không prorate): ngày làm việc chính thức ≥ 14 ngày
  const bhxhExempt = input.bhxhExempt ?? (officialRatio === 0);
  const bhxhBase = input.bhxhBaseSalary ?? input.baseSalary;
  const employeeBhxh = bhxhExempt ? 0 : r(bhxhBase * formula.bhEmployeeRate);
  const companyBhxh = bhxhExempt ? 0 : r(bhxhBase * formula.bhCompanyRate);

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
// ── Gross-Net Calculator helpers ─────────────────────────
// ══════════════════════════════════════════════════════════

/** Simple Gross→Net for calculator (full month, no proration).
 *  bhxhBase: mức lương đóng BHXH riêng (nếu khác gross). undefined/null/0 → dùng gross. */
export function calcGrossToNet(
  gross: number,
  dependents: number,
  isProbation: boolean,
  hasBhxh: boolean,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
  bhxhBase?: number | null,
): PayrollOutput {
  return calculatePayroll({
    workDays: formula.standardWorkDays,
    baseSalary: gross,
    lunchAllowance: 0,
    transportAllowance: 0,
    phoneAllowance: 0,
    clothingAllowance: 0,
    kpiAllowance: 0,
    defaultOt: 0,
    extraOtHours: 0,
    dependentsCount: dependents,
    isProbation,
    bhxhExempt: !hasBhxh,
    bhxhBaseSalary: (bhxhBase && bhxhBase > 0) ? bhxhBase : null,
  }, formula);
}

/** Net→Gross: binary search to find gross that yields target net.
 *  bhxhBase: mức lương đóng BHXH riêng (nếu khác gross). undefined/null/0 → dùng gross. */
export function solveNetToGross(
  targetNet: number,
  dependents: number,
  isProbation: boolean,
  hasBhxh: boolean,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
  bhxhBase?: number | null,
): PayrollOutput {
  if (targetNet <= 0) return calcGrossToNet(0, dependents, isProbation, hasBhxh, formula, bhxhBase);

  let lo = targetNet;
  let hi = targetNet * 2;

  // Expand upper bound if needed
  while (calcGrossToNet(hi, dependents, isProbation, hasBhxh, formula, bhxhBase).netSalary < targetNet) {
    hi *= 2;
  }

  // Binary search (precision: 1000 VND)
  for (let i = 0; i < 50; i++) {
    const mid = Math.round((lo + hi) / 2);
    const result = calcGrossToNet(mid, dependents, isProbation, hasBhxh, formula, bhxhBase);
    if (Math.abs(result.netSalary - targetNet) <= 1000) {
      return result;
    }
    if (result.netSalary < targetNet) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return calcGrossToNet(Math.round((lo + hi) / 2), dependents, isProbation, hasBhxh, formula, bhxhBase);
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
  const { data: allEmployees } = await supabase
    .from('hr_employees')
    .select('*')
    .eq('type', 'fulltime')
    .eq('status', 'active')
    .neq('exclude_from_payroll', true);

  // Loại nhân viên onboard SAU tháng lương (VD start_date 01/07 không vào bảng T6).
  // start_date null → giữ lại (dữ liệu cũ chưa nhập ngày).
  const monthEndISO = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const employees = (allEmployees || []).filter(
    e => !e.start_date || e.start_date <= monthEndISO
  );

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

  // 5b. Fetch salary changes for employees with mid-month transition
  // (used to auto-populate pre_official_base_salary)
  const payrollFirstDay = new Date(year, month - 1, 1);
  const payrollLastDay = new Date(year, month, 0);
  const totalDaysInMonth = payrollLastDay.getDate();

  const transitionEmpIds = employees
    .filter(emp => {
      const officialRaw = (emp as any).official_date
        || (emp.probation_end ? new Date(new Date(emp.probation_end).getTime() + 24 * 3600 * 1000).toISOString().split('T')[0] : null);
      if (!officialRaw) return false;
      const od = new Date(officialRaw);
      return od > payrollFirstDay && od <= payrollLastDay;
    })
    .map(e => e.id);

  // For transition employees: find old base salary from hr_employee_salary records.
  // saveEmployeeSalary() does INSERT (not upsert), so old probation salary records
  // still exist alongside new official salary records for the same component.
  const salaryChangeMap: Record<string, number> = {};
  if (transitionEmpIds.length > 0) {
    // All "Lương cơ bản" records for transition employees, ordered by created_at
    const { data: baseSalaryHistory } = await supabase
      .from('hr_employee_salary')
      .select('employee_id, amount, created_at, component:hr_salary_components(name)')
      .in('employee_id', transitionEmpIds)
      .order('created_at', { ascending: true });

    // Group by employee → find old base salary (second-to-last "Lương cơ bản" record)
    const empBaseRecords: Record<string, number[]> = {};
    (baseSalaryHistory || []).forEach((s: any) => {
      if (s.component?.name === 'Lương cơ bản' && s.amount > 0) {
        if (!empBaseRecords[s.employee_id]) empBaseRecords[s.employee_id] = [];
        empBaseRecords[s.employee_id].push(s.amount);
      }
    });

    for (const empId of transitionEmpIds) {
      const amounts = empBaseRecords[empId];
      // If there are 2+ records and the latest differs from the previous → salary changed
      if (amounts && amounts.length >= 2) {
        const oldBase = amounts[amounts.length - 2];
        const newBase = amounts[amounts.length - 1];
        if (oldBase !== newBase) {
          salaryChangeMap[empId] = oldBase;
        }
      }
    }
  }

  // 6. Build records

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

    // ── BHXH 14-ngày threshold (Luật BHXH VN, TT 59/2015) ──
    // Miễn BHXH nếu: (a) full probation, hoặc (b) chuyển giao giữa tháng + ngày làm việc chính thức < 14
    let bhxhExempt = false;
    if (isProbation) {
      bhxhExempt = true; // cả tháng thử việc → không đóng BHXH
    } else if (probationRatio > 0 && probationRatio < 1 && officialDate) {
      // Tháng chuyển giao: đếm ngày làm việc T2-T6 từ official_date đến hết tháng
      const officialWorkDays = countWeekdaysFromDate(year, month, officialDate.getDate());
      bhxhExempt = officialWorkDays < 14;
    }
    // else: cả tháng chính thức → bhxhExempt = false → đóng full

    // Lương CB trước chính thức (auto-detect từ hr_position_history, hoặc null)
    const preOfficialBaseSalary = (probationRatio > 0 && probationRatio < 1)
      ? (salaryChangeMap[emp.id] ?? null)
      : null;

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
      preOfficialBaseSalary,
      bonus: 0,
      bhxhExempt,
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
      pre_official_base_salary: preOfficialBaseSalary,
      bhxh_exempt: bhxhExempt,
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
    preOfficialBaseSalary: rec.pre_official_base_salary ?? null,
    // Bonus tính vào TNCT → PIT tự tăng theo bậc lũy tiến
    bonus: rec.bonus ?? 0,
    bhxhExempt: rec.bhxh_exempt ?? false,
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
