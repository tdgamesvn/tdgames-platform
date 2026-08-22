import React, { useState, useMemo } from 'react';
import { ExpenseRecord, InvoiceData } from '@/types';

interface Props {
  expenses: ExpenseRecord[];
  invoices: InvoiceData[];
  vcbAvgRate: number; // VND per 1 USD
}

type Period = 'month' | 'quarter' | 'year';
type View = 'overview' | 'byCategory' | 'byClient';

function periodRange(period: Period): { from: Date; to: Date; label: string } {
  const now = new Date();
  // `to` = 23:59:59.999 ngày cuối kỳ — tránh loại nhầm invoice rơi đúng ngày cuối
  // (date string "YYYY-MM-DD" parse ra UTC midnight = 7h sáng giờ VN)
  const endOfDay = (y: number, m: number, d: number) => new Date(y, m, d, 23, 59, 59, 999);
  if (period === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfDay(now.getFullYear(), now.getMonth() + 1, 0),
      label: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
    };
  }
  if (period === 'quarter') {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const fromMonth = (q - 1) * 3;
    return {
      from: new Date(now.getFullYear(), fromMonth, 1),
      to: endOfDay(now.getFullYear(), fromMonth + 3, 0),
      label: `Q${q}/${now.getFullYear()}`,
    };
  }
  return {
    from: new Date(now.getFullYear(), 0, 1),
    to: endOfDay(now.getFullYear(), 11, 31),
    label: `Năm ${now.getFullYear()}`,
  };
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const fmtB = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' triệu';
  return fmt(n);
};

export default function PnlTab({ expenses, invoices, vcbAvgRate }: Props) {
  const [period, setPeriod] = useState<Period>('month');
  const [view, setView] = useState<View>('overview');

  const rate = vcbAvgRate || 25000;
  const { from, to, label } = periodRange(period);

  const inRange = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= from && d <= to;
  };

  // Revenue (accrual): invoices phát sinh trong kỳ theo issue_date, trừ cancelled
  const revenueRows = useMemo(() =>
    invoices.filter(inv => inv.status !== 'cancelled' && inRange(inv.issueDate)),
    [invoices, period]
  );

  // Net revenue của 1 invoice: subtotal - discount (chưa gồm thuế)
  const netOf = (inv: InvoiceData) => {
    const subtotal = (inv.items || []).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
    const discount = inv.discountType === 'percentage'
      ? subtotal * (inv.discountValue || 0) / 100
      : (inv.discountValue || 0);
    return subtotal - discount;
  };

  // Expense (accrual): chi phí phát sinh trong kỳ, tính cả approved + paid
  const expenseRows = useMemo(() =>
    expenses.filter(e =>
      (e.type || 'expense') === 'expense' &&
      ['approved', 'paid'].includes(e.status) &&
      inRange(e.expense_date)
    ),
    [expenses, period]
  );

  // Convert to VND
  const toVnd = (amount: number, currency: string) =>
    currency === 'USD' ? amount * rate : amount;

  const totalRevenue = revenueRows.reduce((s, inv) => s + toVnd(netOf(inv), inv.currency), 0);

  const totalExpense = expenseRows.reduce((s, e) => s + toVnd(e.amount, e.currency), 0);
  const netProfit = totalRevenue - totalExpense;
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // By category
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenseRows) {
      const key = e.category?.name || 'Chưa phân loại';
      map.set(key, (map.get(key) || 0) + toVnd(e.amount, e.currency));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenseRows]);

  // By client
  const byClient = useMemo(() => {
    const map = new Map<string, { revenue: number; expense: number }>();
    for (const inv of revenueRows) {
      const key = inv.clientInfo?.name || 'Không rõ';
      if (!map.has(key)) map.set(key, { revenue: 0, expense: 0 });
      map.get(key)!.revenue += toVnd(netOf(inv), inv.currency);
    }
    for (const e of expenseRows) {
      const key = e.client_name?.trim() || 'Không rõ';
      if (!map.has(key)) map.set(key, { revenue: 0, expense: 0 });
      map.get(key)!.expense += toVnd(e.amount, e.currency);
    }
    return Array.from(map.entries())
      .map(([client, v]) => ({ client, ...v, profit: v.revenue - v.expense }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [revenueRows, expenseRows]);

  const PERIODS: Period[] = ['month', 'quarter', 'year'];
  const VIEWS: { id: View; label: string }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'byCategory', label: 'Theo danh mục' },
    { id: 'byClient', label: 'Theo client' },
  ];

  // Bar chart helpers
  const maxBar = Math.max(totalRevenue, totalExpense, 1);
  const barPct = (v: number) => Math.min(100, (v / maxBar) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Báo cáo Lãi / Lỗ (P&L)</h2>
          <p className="text-neutral-medium text-sm mt-1">{label} • Cơ sở dồn tích • Tỷ giá: {fmt(rate)} VND/USD</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${period === p ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
              style={period === p ? { background: '#FF9500' } : {}}>
              {p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 border-b border-primary/10 pb-4">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === v.id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Doanh thu', value: totalRevenue, color: 'text-emerald-400', prefix: '' },
              { label: 'Chi phí', value: totalExpense, color: 'text-orange-400', prefix: '' },
              { label: 'Lợi nhuận', value: netProfit, color: netProfit >= 0 ? 'text-emerald-400' : 'text-red-400', prefix: netProfit < 0 ? '' : '' },
              { label: 'Biên lợi nhuận', value: margin, color: margin >= 0 ? 'text-sky-400' : 'text-red-400', suffix: '%', isPercent: true },
            ].map(c => (
              <div key={c.label} className="rounded-[20px] border border-primary/10 bg-surface p-4">
                <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-neutral-600">{c.label}</p>
                <p className={`text-2xl font-black ${c.color}`}>
                  {(c as any).isPercent ? `${margin.toFixed(1)}%` : fmtB(c.value)}
                </p>
                {!(c as any).isPercent && <p className="text-neutral-600 text-[10px] mt-0.5">{fmt(c.value)} VND</p>}
              </div>
            ))}
          </div>

          {/* Visual bar chart (CSS only) */}
          <div className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Biểu đồ so sánh</p>
            {[
              { label: 'Doanh thu', value: totalRevenue, color: '#10b981' },
              { label: 'Chi phí', value: totalExpense, color: '#f97316' },
              { label: 'Lợi nhuận', value: Math.abs(netProfit), color: netProfit >= 0 ? '#38bdf8' : '#f87171' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-4">
                <span className="text-neutral-400 text-xs w-24 shrink-0">{row.label}</span>
                <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-3 transition-all"
                    style={{ width: `${barPct(row.value)}%`, background: row.color, minWidth: row.value > 0 ? '8px' : 0 }}>
                    {barPct(row.value) > 15 && (
                      <span className="text-white text-[10px] font-bold">{fmtB(row.value)}</span>
                    )}
                  </div>
                </div>
                <span className="text-neutral-300 text-xs w-24 text-right shrink-0">{fmtB(row.value)}</span>
              </div>
            ))}
          </div>

          {/* Invoice list */}
          <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Hoá đơn phát sinh trong kỳ ({revenueRows.length})</p>
            </div>
            {revenueRows.length === 0 ? (
              <p className="text-center py-8 text-neutral-600 text-sm">Không có hoá đơn trong kỳ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead><tr className="border-b border-white/5">
                    <th className="text-left px-5 py-2 text-neutral-500">Số HĐ</th>
                    <th className="text-left px-5 py-2 text-neutral-500">Client</th>
                    <th className="text-right px-5 py-2 text-neutral-500">Giá trị</th>
                    <th className="text-right px-5 py-2 text-neutral-500">Ngày phát hành</th>
                  </tr></thead>
                  <tbody>
                    {revenueRows.map((inv, i) => {
                      const sub = netOf(inv);
                      return (
                        <tr key={inv.id || i} className="border-b border-white/3 hover:bg-white/2">
                          <td className="px-5 py-2 text-neutral-300 font-mono">{inv.invoiceNumber}</td>
                          <td className="px-5 py-2 text-neutral-400">{inv.clientInfo?.name}</td>
                          <td className="px-5 py-2 text-right text-emerald-400 font-bold">
                            {inv.currency === 'USD' ? `$${fmt(sub)}` : `${fmt(sub)} ₫`}
                          </td>
                          <td className="px-5 py-2 text-right text-neutral-500">{inv.issueDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* By Category */}
      {view === 'byCategory' && (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Chi phí theo danh mục</p>
          </div>
          {byCat.length === 0 ? (
            <p className="text-center py-8 text-neutral-600 text-sm">Không có chi phí trong kỳ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-neutral-500 text-xs uppercase">Danh mục</th>
                  <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase">Số tiền (VND)</th>
                  <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase">% Tổng chi</th>
                </tr></thead>
                <tbody>
                  {byCat.map(([cat, amt]) => (
                    <tr key={cat} className="border-b border-white/3 hover:bg-white/2">
                      <td className="px-5 py-3 text-white">{cat}</td>
                      <td className="px-5 py-3 text-right text-orange-400 font-bold">{fmt(amt)}</td>
                      <td className="px-5 py-3 text-right text-neutral-400">
                        {totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* By Client */}
      {view === 'byClient' && (
        <div className="rounded-[20px] border border-primary/10 bg-surface overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Theo client / dự án</p>
          </div>
          {byClient.length === 0 ? (
            <p className="text-center py-8 text-neutral-600 text-sm">Không có dữ liệu</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-neutral-500 text-xs uppercase">Client</th>
                  <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase">Doanh thu</th>
                  <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase">Chi phí</th>
                  <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase">Lợi nhuận</th>
                </tr></thead>
                <tbody>
                  {byClient.map(row => (
                    <tr key={row.client} className="border-b border-white/3 hover:bg-white/2">
                      <td className="px-5 py-3 text-white font-semibold">{row.client}</td>
                      <td className="px-5 py-3 text-right text-emerald-400">{fmt(row.revenue)}</td>
                      <td className="px-5 py-3 text-right text-orange-400">{fmt(row.expense)}</td>
                      <td className={`px-5 py-3 text-right font-bold ${row.profit >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                        {fmt(row.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
