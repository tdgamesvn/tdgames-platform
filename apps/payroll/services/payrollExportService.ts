import * as XLSX from 'xlsx';
import { PayPayrollSheet, PayPayrollRecord, PayrollFormulaConfig } from '@/types';
import { FALLBACK_PAYROLL_FORMULA } from './payrollFormulaService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

/**
 * Export bảng lương ra file Excel (.xlsx)
 */
export function exportPayrollToExcel(
  sheet: PayPayrollSheet,
  records: PayPayrollRecord[],
  _formula?: PayrollFormulaConfig,
) {
  const rows: any[][] = [];

  // ── Header ──
  rows.push(['TD GAMES COMPANY LIMITED']);
  rows.push([]);
  rows.push([`BẢNG LƯƠNG THÁNG ${sheet.month}/${sheet.year}`]);
  rows.push([]);

  // ── Column headers ──
  rows.push([
    'STT',
    'Mã NV',
    'Họ và tên',
    'Thử việc',
    'Ngày công',
    'Lương CB',
    'Lương CB cũ (TV)',
    'PC ăn trưa',
    'PC xăng xe',
    'PC điện thoại',
    'PC trang phục',
    'KPI',
    'Tăng ca MĐ',
    'TC thường (h)',
    'TC T7/CN (h)',
    'TC lễ/Tết (h)',
    'TC đêm thường (h)',
    'TC đêm T7/CN (h)',
    'TC đêm lễ/Tết (h)',
    'Tăng ca PS (đ)',
    'Gross TK',
    'Gross thực tế',
    'BH NV',
    'Thu nhập chịu thuế',
    'Số NPT',
    'Thu nhập tính thuế',
    'Thuế TNCN',
    'Thưởng KPI',
    'NET thực lĩnh',
    'BH công ty',
    'Chi phí công ty',
  ]);

  // ── Data rows ──
  records.forEach((rec, idx) => {
    rows.push([
      idx + 1,
      rec.employee?.employee_code || '',
      rec.employee?.full_name || '',
      rec.is_probation ? 'Có' : '',
      rec.work_days,
      rec.base_salary,
      rec.pre_official_base_salary ?? '',
      rec.lunch_allowance,
      rec.transport_allowance,
      rec.phone_allowance,
      rec.clothing_allowance,
      rec.kpi_allowance,
      rec.default_ot,
      rec.extra_ot_hours,
      rec.extra_ot_hours_weekend ?? 0,
      rec.extra_ot_hours_holiday ?? 0,
      rec.extra_ot_hours_night ?? 0,
      rec.extra_ot_hours_night_weekend ?? 0,
      rec.extra_ot_hours_night_holiday ?? 0,
      rec.extra_ot,
      rec.gross_ref,
      rec.gross_actual,
      rec.employee_bhxh,
      rec.taxable_income,
      rec.dependents_count,
      rec.assessable_income,
      rec.pit,
      rec.bonus ?? 0,
      rec.net_salary,
      rec.company_bhxh,
      rec.total_company_cost,
    ]);
  });

  // ── Summary row ──
  rows.push([]);
  const sum = (field: keyof PayPayrollRecord) =>
    records.reduce((s, r) => s + (typeof r[field] === 'number' ? (r[field] as number) : 0), 0);

  rows.push([
    '', '', 'TỔNG CỘNG', '',
    '',
    sum('base_salary'),
    '',  // no sum for pre-official salary
    sum('lunch_allowance'),
    sum('transport_allowance'),
    sum('phone_allowance'),
    sum('clothing_allowance'),
    sum('kpi_allowance'),
    sum('default_ot'),
    sum('extra_ot_hours'),
    sum('extra_ot_hours_weekend'),
    sum('extra_ot_hours_holiday'),
    sum('extra_ot_hours_night'),
    sum('extra_ot_hours_night_weekend'),
    sum('extra_ot_hours_night_holiday'),
    sum('extra_ot'),
    sum('gross_ref'),
    sum('gross_actual'),
    sum('employee_bhxh'),
    sum('taxable_income'),
    '',
    sum('assessable_income'),
    sum('pit'),
    sum('bonus'),
    sum('net_salary'),
    sum('company_bhxh'),
    sum('total_company_cost'),
  ]);

  // ── Create workbook ──
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // STT
    { wch: 10 },  // Mã NV
    { wch: 25 },  // Họ tên
    { wch: 10 },  // Thử việc
    { wch: 10 },  // Ngày công
    { wch: 14 },  // Lương CB
    { wch: 14 },  // Lương CB cũ (TV)
    { wch: 14 },  // PC ăn trưa
    { wch: 14 },  // PC xăng xe
    { wch: 14 },  // PC điện thoại
    { wch: 14 },  // PC trang phục
    { wch: 14 },  // KPI
    { wch: 14 },  // TC MĐ
    { wch: 12 },  // TC PS (h)
    { wch: 14 },  // TC PS (đ)
    { wch: 14 },  // Gross TK
    { wch: 14 },  // Gross thực
    { wch: 14 },  // BH NV
    { wch: 14 },  // TNCT
    { wch: 8 },   // NPT
    { wch: 14 },  // TNTT
    { wch: 14 },  // Thuế
    { wch: 14 },  // Thưởng KPI
    { wch: 16 },  // Net
    { wch: 14 },  // BH CT
    { wch: 16 },  // CPCT
  ];

  // Merge title rows
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },  // Company name
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },  // Sheet title
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `T${sheet.month}_${sheet.year}`);

  const fileName = `Bang_Luong_T${sheet.month}_${sheet.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export phiếu lương cá nhân ra Excel
 */
export function exportPaySlipToExcel(
  sheet: PayPayrollSheet,
  rec: PayPayrollRecord,
  formula: PayrollFormulaConfig = FALLBACK_PAYROLL_FORMULA,
) {
  const std = formula.standardWorkDays;
  const ratio = rec.work_days / std;
  const empName = rec.employee?.full_name || 'N/A';
  const empCode = rec.employee?.employee_code || '';

  const rows: any[][] = [];

  rows.push(['CÔNG TY TNHH TD GAMES (TD GAMES COMPANY LIMITED)']);
  rows.push([]);
  rows.push([`PHIẾU LƯƠNG THÁNG ${sheet.month}/${sheet.year}`]);
  rows.push([]);
  rows.push(['Mã nhân viên:', empCode]);
  rows.push(['Họ và tên:', empName]);
  rows.push(['Phòng ban:', rec.employee?.department?.name || '—']);
  rows.push(['Chức vụ:', rec.employee?.position || '—']);
  if (rec.is_probation) {
    rows.push(['Trạng thái:', `THỬ VIỆC – Không đóng BH, Thuế ${(formula.probationPitRate * 100).toFixed(0)}%`]);
  }
  rows.push([]);

  // Detail table
  rows.push(['Khoản mục', 'Tham chiếu', 'Thực tế']);
  rows.push(['Ngày công', `${std} ngày`, `${rec.work_days} ngày`]);
  rows.push(['Tỷ lệ ngày công', '', (ratio * 100).toFixed(2) + '%']);
  rows.push([]);
  rows.push(['— BƯỚC 1-2: LƯƠNG THỰC TẾ —']);
  rows.push(['Lương cơ bản', rec.base_salary, Math.round(rec.base_salary * ratio)]);
  if (rec.pre_official_base_salary != null && rec.probation_ratio > 0 && rec.probation_ratio < 1) {
    const effBase = Math.round(rec.pre_official_base_salary * rec.probation_ratio + rec.base_salary * (1 - rec.probation_ratio));
    rows.push([`  → Lương CB cũ (TV ${Math.round(rec.probation_ratio * 100)}%)`, rec.pre_official_base_salary, Math.round(rec.pre_official_base_salary * rec.probation_ratio * ratio)]);
    rows.push([`  → Lương CB mới (${Math.round((1 - rec.probation_ratio) * 100)}%)`, rec.base_salary, Math.round(rec.base_salary * (1 - rec.probation_ratio) * ratio)]);
    rows.push(['  → Lương CB prorate', effBase, Math.round(effBase * ratio)]);
  }
  rows.push(['Phụ cấp ăn trưa', rec.lunch_allowance, Math.round(rec.lunch_allowance * ratio)]);
  rows.push(['Phụ cấp xăng xe', rec.transport_allowance, Math.round(rec.transport_allowance * ratio)]);
  rows.push(['Phụ cấp điện thoại', rec.phone_allowance, Math.round(rec.phone_allowance * ratio)]);
  rows.push(['Phụ cấp trang phục', rec.clothing_allowance, Math.round(rec.clothing_allowance * ratio)]);
  rows.push(['Phụ cấp KPI', rec.kpi_allowance, Math.round(rec.kpi_allowance * ratio)]);
  rows.push(['Tăng ca mặc định', rec.default_ot, Math.round(rec.default_ot * ratio)]);
  rows.push(['Tăng ca phát sinh', [
    `${rec.extra_ot_hours}h thường`,
    (rec.extra_ot_hours_weekend ?? 0) > 0 ? `${rec.extra_ot_hours_weekend}h T7/CN` : '',
    (rec.extra_ot_hours_holiday ?? 0) > 0 ? `${rec.extra_ot_hours_holiday}h lễ` : '',
    (rec.extra_ot_hours_night ?? 0) > 0 ? `${rec.extra_ot_hours_night}h đêm thường` : '',
    (rec.extra_ot_hours_night_weekend ?? 0) > 0 ? `${rec.extra_ot_hours_night_weekend}h đêm T7/CN` : '',
    (rec.extra_ot_hours_night_holiday ?? 0) > 0 ? `${rec.extra_ot_hours_night_holiday}h đêm lễ` : '',
  ].filter(Boolean).join(' + '), rec.extra_ot]);
  rows.push([]);
  rows.push(['Gross tham chiếu', '', rec.gross_ref]);
  rows.push(['Gross thực tế', '', rec.gross_actual]);
  rows.push([]);

  if (rec.is_probation) {
    rows.push(['— THỬ VIỆC: THUẾ 10% – KHÔNG BH —']);
    rows.push(['BH nhân viên', '', '0 (không đóng)']);
    rows.push(['Thu nhập chịu thuế', '', rec.taxable_income]);
    rows.push([`Thuế TNCN (${(formula.probationPitRate * 100).toFixed(0)}% cố định)`, '', rec.pit]);
  } else {
    rows.push(['— BƯỚC 3-8: BẢO HIỂM → THUẾ → NET —']);
    rows.push([`BH nhân viên (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`, '', rec.employee_bhxh]);
    rows.push(['Thu nhập chịu thuế (CB + ĐT + KPI)', '', rec.taxable_income]);
    rows.push(['Giảm trừ bản thân', '', -formula.personalDeduction]);
    rows.push(['Giảm trừ NPT (' + rec.dependents_count + ' người)', '', -(rec.dependents_count * formula.dependentDeduction)]);
    rows.push(['Thu nhập tính thuế', '', rec.assessable_income]);
    rows.push(['Thuế TNCN (lũy tiến)', '', rec.pit]);
  }
  rows.push([]);
  if ((rec.bonus ?? 0) > 0) {
    rows.push(['Thưởng KPI', '', rec.bonus]);
  }
  rows.push(['NET THỰC LĨNH', '', rec.net_salary]);
  rows.push([]);
  if (rec.is_probation) {
    rows.push(['BH công ty', '', '0 (không đóng)']);
  } else {
    rows.push([`BH công ty (${(formula.bhCompanyRate * 100).toFixed(2)}%)`, '', rec.company_bhxh]);
  }
  rows.push(['Tổng chi phí công ty', '', rec.total_company_cost]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Phiếu lương');

  const fileName = `Phieu_Luong_${empCode}_T${sheet.month}_${sheet.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
