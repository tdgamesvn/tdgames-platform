import React, { useState, useMemo } from 'react';
import { PayPayrollRecord, PayPayrollSheet, HrEmployee, Settlement } from '@/types';

export interface PayrollRecordWithMeta extends PayPayrollRecord {
  sheet?: PayPayrollSheet;
}

interface Props {
  records: PayrollRecordWithMeta[];
  employees: HrEmployee[];
  freelancerSettlements: Settlement[];
  vcbAvgRate: number; // VND per 1 USD
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function getYears(records: PayrollRecordWithMeta[], settlements: Settlement[]): number[] {
  const years = new Set<number>();
  const now = new Date().getFullYear();
  years.add(now);
  for (const r of records) {
    if (r.sheet?.year) years.add(r.sheet.year);
  }
  for (const s of settlements) {
    if (s.period) {
      const y = parseInt(s.period.split('-')[0]);
      if (!isNaN(y)) years.add(y);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

function exportCSV(
  rows: { employee: string; taxCode: string; months: (number | null)[]; totalPit: number; totalTaxable: number }[],
  year: number,
  suffix: string
) {
  const headers = ['Họ tên', 'MST cá nhân', ...MONTHS, 'Tổng thu nhập chịu thuế', 'Tổng TNCN cả năm'];
  const csvRows = rows.map(r => [
    `"${r.employee}"`, r.taxCode || '',
    ...r.months.map(m => (m != null ? m : '')),
    r.totalTaxable, r.totalPit,
  ]);
  const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `TNCN_${suffix}_${year}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Shared pivot table component ──────────────────
function PivotTable({
  rows,
  monthTotals,
  grandTotalPit,
  grandTotalTaxable,
  showTaxCode = true,
}: {
  rows: { key: string; name: string; taxCode?: string; pit: (number | null)[]; totalPit: number; totalTaxable: number }[];
  monthTotals: number[];
  grandTotalPit: number;
  grandTotalTaxable: number;
  showTaxCode?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/8 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <table className="text-xs" style={{ minWidth: '900px' }}>
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider sticky left-0 bg-[#111]">Tên</th>
            {showTaxCode && <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">MST</th>}
            {MONTHS.map(m => (
              <th key={m} className="text-right px-2 py-3 text-neutral-500 uppercase tracking-wider w-16">{m}</th>
            ))}
            <th className="text-right px-4 py-3 text-neutral-400 uppercase tracking-wider font-black">Tổng TNCN</th>
            <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Chịu thuế</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-white/3 hover:bg-white/2">
              <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap sticky left-0 bg-[#111]">{r.name}</td>
              {showTaxCode && <td className="px-3 py-2.5 text-neutral-500 font-mono text-[10px]">{r.taxCode || '—'}</td>}
              {r.pit.map((pit, i) => (
                <td key={i} className="px-2 py-2.5 text-right">
                  {pit != null && pit > 0
                    ? <span className="text-orange-400">{fmt(pit)}</span>
                    : pit === 0
                      ? <span className="text-neutral-700">—</span>
                      : <span className="text-neutral-800">·</span>
                  }
                </td>
              ))}
              <td className="px-4 py-2.5 text-right text-orange-400 font-black">{fmt(r.totalPit)}</td>
              <td className="px-4 py-2.5 text-right text-neutral-400">{fmt(r.totalTaxable)}</td>
            </tr>
          ))}
          <tr className="border-t border-white/10 bg-white/2">
            <td colSpan={showTaxCode ? 2 : 1} className="px-4 py-3 text-neutral-400 font-black uppercase text-xs tracking-wider sticky left-0 bg-[#1a1a1a]">
              Tổng tháng
            </td>
            {monthTotals.map((t, i) => (
              <td key={i} className="px-2 py-3 text-right text-orange-300/70 font-bold">
                {t > 0 ? fmt(t) : <span className="text-neutral-800">—</span>}
              </td>
            ))}
            <td className="px-4 py-3 text-right text-orange-400 font-black">{fmt(grandTotalPit)}</td>
            <td className="px-4 py-3 text-right text-neutral-300 font-black">{fmt(grandTotalTaxable)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function TncnTab({ records, employees, freelancerSettlements, vcbAvgRate }: Props) {
  const rate = vcbAvgRate || 25000;
  const years = getYears(records, freelancerSettlements);
  const [year, setYear] = useState(new Date().getFullYear());

  const empMap = useMemo(() => {
    const m = new Map<string, HrEmployee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // ── Employee pivot ────────────────────────────────
  const yearRecords = useMemo(() =>
    records.filter(r => r.sheet?.year === year && ['confirmed', 'paid'].includes(r.sheet?.status || '')),
    [records, year]
  );

  const employeePivot = useMemo(() => {
    const map = new Map<string, { pit: (number | null)[]; taxable: (number | null)[] }>();
    for (const r of yearRecords) {
      const empId = r.employee_id;
      if (!map.has(empId)) map.set(empId, { pit: Array(12).fill(null), taxable: Array(12).fill(null) });
      const month = (r.sheet?.month || 1) - 1;
      if (month >= 0 && month < 12) {
        map.get(empId)!.pit[month] = (map.get(empId)!.pit[month] || 0) + r.pit;
        map.get(empId)!.taxable[month] = (map.get(empId)!.taxable[month] || 0) + r.taxable_income;
      }
    }
    return Array.from(map.entries())
      .map(([empId, data]) => {
        const emp = empMap.get(empId);
        const totalPit = data.pit.reduce((s, v) => s + (v || 0), 0);
        const totalTaxable = data.taxable.reduce((s, v) => s + (v || 0), 0);
        return {
          key: empId,
          name: emp?.full_name || empId,
          taxCode: emp?.tax_code || '',
          pit: data.pit,
          taxable: data.taxable,
          totalPit,
          totalTaxable,
        };
      })
      .filter(r => r.totalPit > 0 || r.totalTaxable > 0)
      .sort((a, b) => b.totalPit - a.totalPit);
  }, [yearRecords, empMap]);

  const empGrandPit = employeePivot.reduce((s, r) => s + r.totalPit, 0);
  const empGrandTaxable = employeePivot.reduce((s, r) => s + r.totalTaxable, 0);
  const empMonthTotals = MONTHS.map((_, i) => employeePivot.reduce((s, r) => s + (r.pit[i] || 0), 0));

  // ── Freelancer pivot ──────────────────────────────
  const freelancerPivot = useMemo(() => {
    // Filter settlements for the selected year, with tax > 0
    const yearSettlements = freelancerSettlements.filter(s => {
      if (!s.period) return false;
      const y = parseInt(s.period.split('-')[0]);
      return y === year && s.tax_amount > 0;
    });

    const map = new Map<string, { pit: (number | null)[]; taxable: (number | null)[] }>();

    for (const s of yearSettlements) {
      const name = (s.worker as any)?.full_name || s.worker_id;
      const month = parseInt((s.period || '').split('-')[1] || '1') - 1;
      if (month < 0 || month > 11) continue;

      // Convert to VND
      const taxVnd = s.currency === 'USD' ? s.tax_amount * rate : s.tax_amount;
      const totalVnd = s.currency === 'USD' ? s.total_amount * rate : s.total_amount;

      if (!map.has(name)) map.set(name, { pit: Array(12).fill(null), taxable: Array(12).fill(null) });
      map.get(name)!.pit[month] = (map.get(name)!.pit[month] || 0) + taxVnd;
      map.get(name)!.taxable[month] = (map.get(name)!.taxable[month] || 0) + totalVnd;
    }

    return Array.from(map.entries())
      .map(([name, data]) => {
        const totalPit = data.pit.reduce((s, v) => s + (v || 0), 0);
        const totalTaxable = data.taxable.reduce((s, v) => s + (v || 0), 0);
        return { key: name, name, pit: data.pit, taxable: data.taxable, totalPit, totalTaxable };
      })
      .filter(r => r.totalPit > 0)
      .sort((a, b) => b.totalPit - a.totalPit);
  }, [freelancerSettlements, year, rate]);

  const flGrandPit = freelancerPivot.reduce((s, r) => s + r.totalPit, 0);
  const flGrandTaxable = freelancerPivot.reduce((s, r) => s + r.totalTaxable, 0);
  const flMonthTotals = MONTHS.map((_, i) => freelancerPivot.reduce((s, r) => s + (r.pit[i] || 0), 0));

  const totalAllPit = empGrandPit + flGrandPit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Quyết toán TNCN</h2>
          <p className="text-neutral-medium text-sm mt-1">Năm {year} • Nhân viên + Freelancer • Tỷ giá: {fmt(rate)} VND/USD</p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
            style={{ background: '#1a1a1a' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {employeePivot.length > 0 && (
            <button
              onClick={() => exportCSV(employeePivot.map(r => ({ employee: r.name, taxCode: r.taxCode || '', months: r.pit, totalPit: r.totalPit, totalTaxable: r.totalTaxable })), year, 'NhanVien')}
              className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/30 transition-all">
              ⬇ CSV Nhân viên
            </button>
          )}
          {freelancerPivot.length > 0 && (
            <button
              onClick={() => exportCSV(freelancerPivot.map(r => ({ employee: r.name, taxCode: '', months: r.pit, totalPit: r.totalPit, totalTaxable: r.totalTaxable })), year, 'Freelancer')}
              className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/30 transition-all">
              ⬇ CSV Freelancer
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'TNCN nhân viên', value: fmt(empGrandPit), unit: 'VND', color: 'text-orange-400' },
          { label: 'TNCN freelancer (10%)', value: fmt(flGrandPit), unit: 'VND', color: 'text-orange-400' },
          { label: 'Tổng TNCN phải nộp', value: fmt(totalAllPit), unit: 'VND', color: 'text-orange-300' },
          { label: 'Số freelancer', value: String(freelancerPivot.length), unit: 'người', color: 'text-white' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{c.value} <span className="text-xs font-normal text-neutral-600">{c.unit}</span></p>
          </div>
        ))}
      </div>

      {/* ── EMPLOYEE SECTION ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">👤 Nhân viên chính thức</p>
          <div className="flex-1 h-px bg-white/5" />
          <p className="text-xs text-neutral-600">Từ bảng lương đã xác nhận / đã trả</p>
        </div>
        {employeePivot.length === 0 ? (
          <div className="text-center py-10 text-neutral-600 text-sm">
            Chưa có bảng lương nào được xác nhận trong năm {year}
          </div>
        ) : (
          <PivotTable
            rows={employeePivot}
            monthTotals={empMonthTotals}
            grandTotalPit={empGrandPit}
            grandTotalTaxable={empGrandTaxable}
            showTaxCode={true}
          />
        )}
      </div>

      {/* ── FREELANCER SECTION ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">🧑‍💻 Freelancer (khấu trừ 10% tại nguồn)</p>
          <div className="flex-1 h-px bg-white/5" />
          <p className="text-xs text-neutral-600">Từ các nghiệm thu đã thanh toán</p>
        </div>
        {freelancerPivot.length === 0 ? (
          <div className="text-center py-10 text-neutral-600 text-sm">
            Không có dữ liệu freelancer trong năm {year}
          </div>
        ) : (
          <PivotTable
            rows={freelancerPivot}
            monthTotals={flMonthTotals}
            grandTotalPit={flGrandPit}
            grandTotalTaxable={flGrandTaxable}
            showTaxCode={false}
          />
        )}
      </div>

      <p className="text-neutral-600 text-xs">
        * Freelancer: TNCN khấu trừ tại nguồn 10% theo Thông tư 111/2013/TT-BTC. Số liệu quy đổi về VND theo tỷ giá bình quân VCB.
      </p>
    </div>
  );
}
