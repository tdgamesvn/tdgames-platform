import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { BhxhEmployee } from '../services/accountingService';
import {
  fetchPayrollFormulaForMonth,
  FALLBACK_PAYROLL_FORMULA,
} from '../../payroll/services/payrollFormulaService';
import type { PayrollFormulaConfig } from '@/types';

interface Props {
  employees: BhxhEmployee[];
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const now = new Date();

// Nhân viên đang thử việc tại thời điểm đầu tháng được chọn
function isProbationaryInMonth(emp: BhxhEmployee, year: number, month: number): boolean {
  // Nếu chưa có official_date → vẫn thử việc
  if (!emp.official_date) return true;
  const monthStart = new Date(year, month - 1, 1);
  const officialDate = new Date(emp.official_date);
  // Chính thức sau ngày 1 của tháng → tháng đó vẫn tính là thử việc (không đóng BH)
  return officialDate > monthStart;
}

interface BhxhRow {
  stt: number;
  employee_code: string;
  full_name: string;
  department_name: string | null;
  insurance_number: string;
  bhxh_base: number;
  employee_contrib: number;
  company_contrib: number;
  total: number;
  note: string;
}

function computeRows(
  employees: BhxhEmployee[],
  formula: PayrollFormulaConfig,
  year: number,
  month: number,
): BhxhRow[] {
  const r = (v: number) => Math.round(v);
  let stt = 0;
  return employees
    .filter(emp => !isProbationaryInMonth(emp, year, month))
    .map(emp => {
      stt++;
      const base = emp.salary;
      const empContrib = r(base * formula.bhEmployeeRate);
      const compContrib = r(base * formula.bhCompanyRate);
      // Ghi chú nhân viên mới vào trong tháng
      let note = '';
      if (emp.start_date) {
        const start = new Date(emp.start_date);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0);
        if (start >= monthStart && start <= monthEnd) {
          note = `Mới vào ${start.getDate()}/${month}`;
        }
      }
      return {
        stt,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        department_name: emp.department_name,
        insurance_number: emp.insurance_number,
        bhxh_base: base,
        employee_contrib: empContrib,
        company_contrib: compContrib,
        total: empContrib + compContrib,
        note,
      };
    });
}

function exportExcel(rows: BhxhRow[], formula: PayrollFormulaConfig, month: number, year: number) {
  const data: any[][] = [];
  data.push(['TD GAMES COMPANY LIMITED']);
  data.push([`BẢNG KÊ NỘP BẢO HIỂM XÃ HỘI THÁNG ${month}/${year}`]);
  data.push([`Hạn nộp: Trước ngày 25/${month}/${year}`]);
  data.push([]);
  data.push([
    'STT', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Mã số BHXH',
    'Lương đóng BH',
    `NV đóng (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`,
    `Công ty đóng (${(formula.bhCompanyRate * 100).toFixed(2)}%)`,
    'Tổng đóng',
    'Ghi chú',
  ]);
  rows.forEach(r => {
    data.push([
      r.stt, r.employee_code, r.full_name, r.department_name || '',
      r.insurance_number,
      r.bhxh_base, r.employee_contrib, r.company_contrib, r.total, r.note,
    ]);
  });
  data.push([]);
  data.push([
    '', '', 'TỔNG CỘNG', '', '',
    rows.reduce((s, r) => s + r.bhxh_base, 0),
    rows.reduce((s, r) => s + r.employee_contrib, 0),
    rows.reduce((s, r) => s + r.company_contrib, 0),
    rows.reduce((s, r) => s + r.total, 0),
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 5 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `BHXH_T${month}_${year}`);
  XLSX.writeFile(wb, `Bang_Ke_BHXH_T${month}_${year}.xlsx`);
}

export default function BhxhTab({ employees }: Props) {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [formula, setFormula] = useState<PayrollFormulaConfig>(FALLBACK_PAYROLL_FORMULA);
  const [formulaLoading, setFormulaLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFormulaLoading(true);
    fetchPayrollFormulaForMonth(month, year)
      .then(({ config }) => { if (!cancelled) setFormula(config); })
      .catch(() => { if (!cancelled) setFormula(FALLBACK_PAYROLL_FORMULA); })
      .finally(() => { if (!cancelled) setFormulaLoading(false); });
    return () => { cancelled = true; };
  }, [month, year]);

  const rows = useMemo(
    () => computeRows(employees, formula, year, month),
    [employees, formula, year, month],
  );

  const totalBase = rows.reduce((s, r) => s + r.bhxh_base, 0);
  const totalEmp = rows.reduce((s, r) => s + r.employee_contrib, 0);
  const totalComp = rows.reduce((s, r) => s + r.company_contrib, 0);
  const totalAll = rows.reduce((s, r) => s + r.total, 0);

  const probationaryCount = employees.filter(
    emp => isProbationaryInMonth(emp, year, month)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-black uppercase tracking-wider text-white">
            Bảng kê nộp BHXH
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Hạn nộp: trước ngày 25 hàng tháng · Chỉ nhân viên chính thức
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500/50"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-orange-500/50"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => exportExcel(rows, formula, month, year)}
            disabled={rows.length === 0}
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-primary text-black hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            ↓ Xuất Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Nhân viên tham gia', value: rows.length.toString(), unit: 'người', color: 'text-white' },
          { label: `NV đóng (${(formula.bhEmployeeRate * 100).toFixed(2)}%)`, value: fmt(totalEmp), unit: 'đ', color: 'text-orange-400' },
          { label: `Công ty đóng (${(formula.bhCompanyRate * 100).toFixed(2)}%)`, value: fmt(totalComp), unit: 'đ', color: 'text-blue-400' },
          { label: 'Tổng nộp', value: fmt(totalAll), unit: 'đ', color: 'text-green-400' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-2">{card.label}</div>
            <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-[10px] text-neutral-600 mt-0.5">{card.unit}</div>
          </div>
        ))}
      </div>

      {/* Status notices */}
      <div className="flex items-center gap-3 flex-wrap">
        {formulaLoading && (
          <span className="text-[10px] text-neutral-600 uppercase tracking-wider">Đang tải công thức...</span>
        )}
        {probationaryCount > 0 && (
          <span
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ background: 'rgba(255,167,38,0.12)', color: '#FFA726' }}
          >
            ⚠ {probationaryCount} NV thử việc – không tính vào bảng kê
          </span>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div
          className="rounded-2xl border border-white/8 py-20 text-center"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="text-3xl mb-3">🛡️</div>
          <div className="text-sm font-semibold text-neutral-400">Không có nhân viên chính thức trong tháng này</div>
          <div className="text-xs text-neutral-600 mt-1">Kiểm tra lại ngày chính thức trong HR</div>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-white/8 overflow-x-auto"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <table className="text-xs w-full" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider w-10">STT</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Mã NV</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Họ và tên</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Phòng ban</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Mã BHXH</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Lương đóng BH</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">NV đóng</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Công ty đóng</th>
                <th className="text-right px-4 py-3 text-neutral-400 uppercase tracking-wider font-black">Tổng đóng</th>
                <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.employee_code} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-neutral-600">{row.stt}</td>
                  <td className="px-3 py-2.5 text-neutral-400 font-mono">{row.employee_code}</td>
                  <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap">{row.full_name}</td>
                  <td className="px-3 py-2.5 text-neutral-400 whitespace-nowrap">{row.department_name || '—'}</td>
                  <td className="px-3 py-2.5 text-neutral-400 font-mono">
                    {row.insurance_number || <span className="text-red-400/70">Chưa có</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white">{fmt(row.bhxh_base)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-400">{fmt(row.employee_contrib)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmt(row.company_contrib)}</td>
                  <td className="px-4 py-2.5 text-right text-green-400 font-black">{fmt(row.total)}</td>
                  <td className="px-3 py-2.5 text-neutral-500 whitespace-nowrap">
                    {row.note ? <span style={{ color: '#FFA726' }}>{row.note}</span> : ''}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-white/10 bg-white/2">
                <td colSpan={5} className="px-4 py-3 text-neutral-400 font-black uppercase text-xs tracking-wider">
                  Tổng cộng ({rows.length} người)
                </td>
                <td className="px-4 py-3 text-right text-white font-black">{fmt(totalBase)}</td>
                <td className="px-4 py-3 text-right text-orange-400 font-black">{fmt(totalEmp)}</td>
                <td className="px-4 py-3 text-right text-blue-400 font-black">{fmt(totalComp)}</td>
                <td className="px-4 py-3 text-right text-green-400 font-black">{fmt(totalAll)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
