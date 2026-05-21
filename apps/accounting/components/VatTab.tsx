import React, { useState, useMemo } from 'react';
import { InvoiceData } from '@/types';

interface Props {
  invoices: InvoiceData[];
  vcbAvgRate: number;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

const QUARTERS = [
  { q: 1, months: [1, 2, 3], label: 'Quý 1 (T1–T3)' },
  { q: 2, months: [4, 5, 6], label: 'Quý 2 (T4–T6)' },
  { q: 3, months: [7, 8, 9], label: 'Quý 3 (T7–T9)' },
  { q: 4, months: [10, 11, 12], label: 'Quý 4 (T10–T12)' },
];

function getYears(invoices: InvoiceData[]): number[] {
  const years = new Set<number>();
  for (const inv of invoices) {
    const d = inv.issueDate || inv.paidDate;
    if (d) years.add(new Date(d).getFullYear());
  }
  const now = new Date().getFullYear();
  years.add(now);
  return Array.from(years).sort((a, b) => b - a);
}

function calcInvoiceVat(inv: InvoiceData, rate: number): { subtotal: number; vatAmt: number; totalVnd: number } {
  const sub = (inv.items || []).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const afterDiscount = inv.discountType === 'percentage'
    ? sub * (1 - (inv.discountValue || 0) / 100)
    : sub - (inv.discountValue || 0);
  const vatAmt = afterDiscount * (inv.taxRate || 0) / 100;
  const total = afterDiscount + vatAmt;
  const toVnd = inv.currency === 'USD' ? rate : 1;
  return {
    subtotal: afterDiscount * toVnd,
    vatAmt: vatAmt * toVnd,
    totalVnd: total * toVnd,
  };
}

function exportCSV(rows: any[], filename: string) {
  const headers = ['Số HĐ', 'Ngày xuất', 'Khách hàng', 'Pháp nhân', 'Doanh thu (VND)', 'Thuế suất (%)', 'Thuế GTGT (VND)', 'Tổng cộng (VND)'];
  const csvRows = rows.map(r => [
    r.invoiceNumber, r.issueDate, `"${r.client}"`, r.entity,
    r.subtotal, r.taxRate, r.vatAmt, r.total,
  ]);
  const csv = [headers, ...csvRows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function VatTab({ invoices, vcbAvgRate }: Props) {
  const rate = vcbAvgRate || 25000;
  const years = getYears(invoices);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedQ, setSelectedQ] = useState<number | 'all'>('all');

  // Chỉ lấy invoices đã phát hành (pending + paid, trừ cancelled)
  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const d = inv.issueDate;
      if (!d) return false;
      const date = new Date(d);
      if (date.getFullYear() !== year) return false;
      if (selectedQ !== 'all') {
        const q = QUARTERS.find(qt => qt.q === selectedQ)!;
        if (!q.months.includes(date.getMonth() + 1)) return false;
      }
      return true;
    });
  }, [invoices, year, selectedQ]);

  // Build rows for table
  const rows = useMemo(() => filtered.map(inv => {
    const { subtotal, vatAmt, totalVnd } = calcInvoiceVat(inv, rate);
    return {
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      client: inv.clientInfo?.name || '—',
      entity: inv.billing_entity || 'TD GAMES',
      currency: inv.currency,
      taxRate: inv.taxRate || 0,
      subtotal: Math.round(subtotal),
      vatAmt: Math.round(vatAmt),
      total: Math.round(totalVnd),
      status: inv.status,
    };
  }), [filtered, rate]);

  // Quarterly breakdown
  const byQuarter = useMemo(() => QUARTERS.map(qt => {
    const qRows = rows.filter(r => {
      if (!r.issueDate) return false;
      return qt.months.includes(new Date(r.issueDate).getMonth() + 1);
    });
    return {
      ...qt,
      rows: qRows,
      subtotal: qRows.reduce((s, r) => s + r.subtotal, 0),
      vatAmt: qRows.reduce((s, r) => s + r.vatAmt, 0),
      total: qRows.reduce((s, r) => s + r.total, 0),
      count: qRows.length,
    };
  }), [rows]);

  const totSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);
  const totVat = rows.reduce((s, r) => s + r.vatAmt, 0);
  const totTotal = rows.reduce((s, r) => s + r.total, 0);

  const label = selectedQ === 'all' ? `Cả năm ${year}` : `${QUARTERS.find(q => q.q === selectedQ)?.label} ${year}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white font-black text-lg uppercase tracking-wider">🧾 Bảng kê VAT (Thuế GTGT)</h2>
          <p className="text-neutral-500 text-xs mt-0.5">{label} • Tỷ giá quy đổi: {fmt(rate)} VND/USD</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Year */}
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl text-xs text-neutral-300 border border-white/10 outline-none"
            style={{ background: '#1a1a1a' }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Quarter */}
          {(['all', 1, 2, 3, 4] as const).map(q => (
            <button key={q} onClick={() => setSelectedQ(q)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${selectedQ === q ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
              style={selectedQ === q ? { background: '#FF9500' } : {}}>
              {q === 'all' ? 'Cả năm' : `Q${q}`}
            </button>
          ))}
          {/* Export */}
          <button
            onClick={() => exportCSV(rows, `VAT_${label.replace(/\s/g, '_')}.csv`)}
            className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/30 transition-all">
            ⬇ Xuất CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Doanh thu (chưa VAT)', value: totSubtotal, color: 'text-white' },
          { label: 'Thuế GTGT', value: totVat, color: 'text-orange-400' },
          { label: 'Tổng cộng', value: totTotal, color: 'text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{fmt(c.value)} <span className="text-xs font-normal text-neutral-600">VND</span></p>
          </div>
        ))}
      </div>

      {/* Quarterly summary (only in 'all' view) */}
      {selectedQ === 'all' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byQuarter.map(qt => (
            <button key={qt.q} onClick={() => setSelectedQ(qt.q)}
              className="rounded-2xl border border-white/8 p-4 text-left hover:border-white/20 transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-neutral-400 text-xs font-black uppercase tracking-wider mb-2">{qt.label}</p>
              <p className="text-white font-bold text-sm">{qt.count} hoá đơn</p>
              <p className="text-orange-400 text-xs mt-1">VAT: {fmt(qt.vatAmt)}</p>
              <p className="text-neutral-500 text-xs">DT: {fmt(qt.subtotal)}</p>
            </button>
          ))}
        </div>
      )}

      {/* Invoice table */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-neutral-600 text-sm">Không có hoá đơn trong kỳ này</div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Số HĐ</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Ngày xuất</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Khách hàng</th>
                <th className="text-left px-4 py-3 text-neutral-500 uppercase tracking-wider">Pháp nhân</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Doanh thu</th>
                <th className="text-center px-4 py-3 text-neutral-500 uppercase tracking-wider">Thuế suất</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">VAT</th>
                <th className="text-right px-4 py-3 text-neutral-500 uppercase tracking-wider">Tổng cộng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/2">
                  <td className="px-4 py-2.5 text-neutral-300 font-mono">{r.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-neutral-500">{r.issueDate}</td>
                  <td className="px-4 py-2.5 text-white font-semibold truncate max-w-[160px]">{r.client}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-white/5 text-neutral-400">
                      {r.entity === 'TD CONSULTING' ? 'CONSULTING' : r.entity === 'Cá nhân' ? 'CÁ NHÂN' : 'TD GAMES'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-neutral-300">{fmt(r.subtotal)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.taxRate > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-orange-500/15 text-orange-300">{r.taxRate}%</span>
                    ) : (
                      <span className="text-neutral-600">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-orange-400 font-bold">{fmt(r.vatAmt)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">{fmt(r.total)}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t border-white/10 bg-white/2">
                <td colSpan={4} className="px-4 py-3 text-neutral-400 font-black uppercase text-xs tracking-wider">
                  Tổng {rows.length} hoá đơn
                </td>
                <td className="px-4 py-3 text-right text-white font-black">{fmt(totSubtotal)}</td>
                <td />
                <td className="px-4 py-3 text-right text-orange-400 font-black">{fmt(totVat)}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-black">{fmt(totTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
