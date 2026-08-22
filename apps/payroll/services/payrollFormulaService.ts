import { supabase } from '@/services/supabaseClient';
import type {
  PayPayrollFormulaSettings,
  PayrollFormulaConfig,
  PayrollTaxBracketRow,
} from '@/types';

/** Dùng khi DB lỗi / chưa seed — khớp logic cũ trong code. */
export const FALLBACK_PAYROLL_FORMULA: PayrollFormulaConfig = {
  standardWorkDays: 22,
  hoursPerDay: 8,
  bhEmployeeRate: 0.105,
  bhCompanyRate: 0.215,
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  otRateWeekday: 1.5,
  otRateWeekend: 2.0,
  otRateHoliday: 3.0,
  // OT ban đêm (NĐ 145/2020 Đ.57 k.3) = hệ số OT + 30% + 20% × đơn giá ban ngày của loại ngày đó
  otRateNightWeekday: 2.0,  // 150 + 30 + 20%×100
  otRateNightWeekend: 2.7,  // 200 + 30 + 20%×200
  otRateNightHoliday: 3.9,  // 300 + 30 + 20%×300
  probationPitRate: 0.1,
  taxBrackets: [
    { limit: 10_000_000, rate: 0.05, deduction: 0 },
    { limit: 30_000_000, rate: 0.10, deduction: 500_000 },
    { limit: 60_000_000, rate: 0.20, deduction: 3_500_000 },
    { limit: 100_000_000, rate: 0.30, deduction: 9_500_000 },
    { limit: Number.POSITIVE_INFINITY, rate: 0.35, deduction: 14_500_000 },
  ],
};

function parseTaxBrackets(raw: unknown): { limit: number; rate: number; deduction: number }[] {
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_PAYROLL_FORMULA.taxBrackets;
  const rows = raw as PayrollTaxBracketRow[];
  const out: { limit: number; rate: number; deduction: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (typeof b?.rate !== 'number' || typeof b?.deduction !== 'number') continue;
    const lim = b.limit;
    const limitNum = lim === null || lim === undefined ? Number.POSITIVE_INFINITY : Number(lim);
    if (!Number.isFinite(limitNum) && lim !== null && lim !== undefined) continue;
    out.push({
      limit: lim === null || lim === undefined ? Number.POSITIVE_INFINITY : limitNum,
      rate: b.rate,
      deduction: b.deduction,
    });
  }
  if (out.length === 0) return FALLBACK_PAYROLL_FORMULA.taxBrackets;
  out.sort((a, b) => {
    if (a.limit === Number.POSITIVE_INFINITY) return 1;
    if (b.limit === Number.POSITIVE_INFINITY) return -1;
    return a.limit - b.limit;
  });
  return out;
}

export function settingsRowToConfig(row: PayPayrollFormulaSettings): PayrollFormulaConfig {
  return {
    standardWorkDays: Number(row.standard_work_days),
    hoursPerDay: Number(row.hours_per_day),
    bhEmployeeRate: Number(row.bh_employee_rate),
    bhCompanyRate: Number(row.bh_company_rate),
    personalDeduction: Number(row.personal_deduction),
    dependentDeduction: Number(row.dependent_deduction),
    otRateWeekday: Number(row.ot_rate_weekday),
    // Bảng công thức cũ (trước migration OT theo loại ngày) không có 2 cột này → fallback luật định.
    otRateWeekend: Number(row.ot_rate_weekend ?? FALLBACK_PAYROLL_FORMULA.otRateWeekend),
    otRateHoliday: Number(row.ot_rate_holiday ?? FALLBACK_PAYROLL_FORMULA.otRateHoliday),
    // Bảng công thức cũ (trước migration OT ban đêm) không có 3 cột này → fallback luật định.
    otRateNightWeekday: Number(row.ot_rate_night_weekday ?? FALLBACK_PAYROLL_FORMULA.otRateNightWeekday),
    otRateNightWeekend: Number(row.ot_rate_night_weekend ?? FALLBACK_PAYROLL_FORMULA.otRateNightWeekend),
    otRateNightHoliday: Number(row.ot_rate_night_holiday ?? FALLBACK_PAYROLL_FORMULA.otRateNightHoliday),
    probationPitRate: Number(row.probation_pit_rate),
    taxBrackets: parseTaxBrackets(row.tax_brackets),
  };
}

/** Bản công thức áp dụng cho tháng lương: effective_from <= ngày đầu tháng đó, mới nhất. */
export async function fetchPayrollFormulaForMonth(
  month: number,
  year: number,
): Promise<{ settings: PayPayrollFormulaSettings | null; config: PayrollFormulaConfig }> {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const { data, error } = await supabase
    .from('pay_payroll_formula_settings')
    .select('*')
    .lte('effective_from', monthStart)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { settings: null, config: FALLBACK_PAYROLL_FORMULA };
  }
  const settings = data as PayPayrollFormulaSettings;
  return { settings, config: settingsRowToConfig(settings) };
}

export async function fetchPayrollFormulaById(
  id: string,
): Promise<{ settings: PayPayrollFormulaSettings; config: PayrollFormulaConfig } | null> {
  const { data, error } = await supabase
    .from('pay_payroll_formula_settings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const settings = data as PayPayrollFormulaSettings;
  return { settings, config: settingsRowToConfig(settings) };
}

export async function fetchAllPayrollFormulas(): Promise<PayPayrollFormulaSettings[]> {
  const { data, error } = await supabase
    .from('pay_payroll_formula_settings')
    .select('*')
    .order('effective_from', { ascending: false });
  if (error) throw error;
  return (data || []) as PayPayrollFormulaSettings[];
}

export type PayrollFormulaUpsert = {
  name: string;
  effective_from: string;
  standard_work_days: number;
  hours_per_day: number;
  bh_employee_rate: number;
  bh_company_rate: number;
  personal_deduction: number;
  dependent_deduction: number;
  ot_rate_weekday: number;
  ot_rate_weekend: number;
  ot_rate_holiday: number;
  ot_rate_night_weekday: number;
  ot_rate_night_weekend: number;
  ot_rate_night_holiday: number;
  probation_pit_rate: number;
  tax_brackets: PayrollTaxBracketRow[];
  notes?: string;
};

export async function insertPayrollFormula(payload: PayrollFormulaUpsert): Promise<PayPayrollFormulaSettings> {
  const { data, error } = await supabase
    .from('pay_payroll_formula_settings')
    .insert({
      ...payload,
      tax_brackets: JSON.parse(JSON.stringify(payload.tax_brackets)),
      notes: payload.notes ?? '',
    } as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as PayPayrollFormulaSettings;
}

export async function updatePayrollFormula(
  id: string,
  payload: PayrollFormulaUpsert,
): Promise<PayPayrollFormulaSettings> {
  const { data, error } = await supabase
    .from('pay_payroll_formula_settings')
    .update({
      ...payload,
      tax_brackets: JSON.parse(JSON.stringify(payload.tax_brackets)),
      notes: payload.notes ?? '',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PayPayrollFormulaSettings;
}

export async function deletePayrollFormula(id: string): Promise<void> {
  const { error } = await supabase.from('pay_payroll_formula_settings').delete().eq('id', id);
  if (error) throw error;
}
