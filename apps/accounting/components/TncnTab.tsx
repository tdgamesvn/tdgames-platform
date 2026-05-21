import React, { useState, useMemo } from 'react';
import { PayPayrollRecord, PayPayrollSheet, HrEmployee } from '@/types';

export interface PayrollRecordWithMeta extends PayPayrollRecord {
  sheet?: PayPayrollSheet;
}

interface Props {
  records: PayrollRecordWithMeta[];
  employees: HrEmployee[];
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function getYears(records: PayrollRecordWithMeta[]): number[] {
  const years = new Set<number>();
  const now = new Date().getFullYear();
  years.add(now);
  for (const r of records) {
    if (r.sheet?.year) years.add(r.sheet.year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

function exportCSV(
  rows: { employee: string; taxCode: string; months: (number | null)[]; totalPit: number; totalTaxable: number }[],
  year: number
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
  const a = document.createElement('a'); a.href = url; a.download = `TNCN_${year}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function TncnTab({ records, employees }: Props) {
  const years = getYears(records);
  const [year, setYear] = useState(new Date().getFullYear());

  const empMap = useMemo(() => {
    const m = new Map<string, HrEmployee>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // Filter records for selected year, only confirmed/paid sheets
  const yearRecords = useMemo(() =>
    records.filter(r => r.sheet?.year === year && ['confirmed', 'paid'].includes(r.sheet?.status || '')),
    [records, year]
  );

  // Build pivot: employee → [pit per month (1-12)]
  const pivot = useMemo(() => {
    const map = new Map<string, { pit: (number | null)[]; taxable: (number | null)[] }>();

    for (const r of yearRecords) {
      const empId = r.employee_id;
      if (!map.has(empId)) {
        map.set(empId, {
          pit: Array(12).fill(null),
          taxable: Array(12).fill(null),
        });
      }
      const month = (r.sheet?.month || 1) - 1; // 0-indexed
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
          empId,
          employee: emp?.full_name || empId,
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

  const grandTotalPit = pivot.reduce((s, r) => s + r.totalPit, 0);
  const grandTotalTaxable = pivot.reduce((s, r) => s + r.totalTaxable, 0);

  // Month totals
  const monthTotals = MONTHS.map((_, i) => pivot.reduce((s, r) => s + (r.pit[i] || 0), 0));

  const exportRows = pivot.map(r => ({
    employee: r.employee,
    taxCode: r.taxCode,
    months: r.pit,
    totalPit: r.totalPit,
    totalTaxable: r.totalTaxable,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white font-black text-lg uppercase tracking-wider">💼 Quyết toán TNCN</h2>
          <p className="text-neutral-500 text-xs mt-0.5">Năm {year} • Từ bảng lương đã xác nhận / đã trả</p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
            style={{ background: '#1a1a1a' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => exportCSV(exportRows, year)}
            disabled={pivot.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/30 transition-all disabled:opacity-30">
            ⬇ Xuất CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Số nhân viên', value: String(pivot.length), unit: 'người', color: 'text-white' },
          { label: 'Tổng thu nhập chịu thuế', value: fmt(grandTotalTaxable), unit: 'VND', color: 'text-neutral-300' },
          { label: 'Tổng TNCN phải nộp', value: fmt(grandTotalPit), unit: 'VND', color: 'text-orange-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">{c.label}</p>
            <p className={`text-lg font-black ${c.color}`}>{c.value} <span className="text-xs font-normal text-neutral-600">{c.unit}</span></p>
          </div>
        ))}
      </div>

      {pivot.length === 0 ? (
        <div className="text-center py-16 text-neutral-600 text-sm">
          Chưa có bảng lương nào được xác nhận / đã trả trong năm {year}
        </div>
      ) : (
        <>
          {/* Pivot table */}
          <div className="rounded-2xl border border-white/8 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <table className="text-xs" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider sticky left-0 bg-[#111]">Nhân viên</th>
                  <th className="text-left px-3 py-3 text-neutral-500 uppercase tracking-wider">MST</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right px-2 py-3 text-neutral-500 uppercase tracking-wider w-16">{m}</th>
                  ))}
                  <th className="text-right px-4 py-3 text-neutral-400 uppercase tracking-wider font-black">Tổng TNCN</th>
                  <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Chịu thuế</th>
                </tr>
              </thead>
              <tbody>
                {pivot.map(r => (
                  <tr key={r.empId} className="border-b border-white/3 hover:bg-white/2">
                    <td className="px-4 py-2.5 text-white font-semibold whitespace-nowrap sticky left-0 bg-[#111]">{r.employee}</td>
                    <td className="px-3 py-2.5 text-neutral-500 font-mono text-[10px]">{r.taxCode || '—'}</td>
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

                {/* Monthly totals row */}
                <tr className="border-t border-white/10 bg-white/2">
                  <td colSpan={2} className="px-4 py-3 text-neutral-400 font-black uppercase text-xs tracking-wider sticky left-0 bg-[#1a1a1a]">
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

          {/* Note */}
          <p className="text-neutral-600 text-xs">
            * Chỉ tính từ bảng lương có trạng thái <span className="text-neutral-400">Đã xác nhận</span> hoặc <span className="text-neutral-400">Đã trả</span>.
            Bảng lương nháp không được tính.
          </p>
        </>
      )}
    </div>
  );
}
