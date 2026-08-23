import React, { useMemo, useState } from 'react';
import { ExpenseRecord, ExpenseCategory } from '@/types';
import { syncInvoiceRevenue } from '../services/expenseService';

interface Props {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
  isLoading: boolean;
  onNavigateToList: () => void;
  onRefresh?: () => void;
  vcbAvgRate: number;
}

// ── Helpers ─────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtVND = (n: number) => fmt(Math.round(n)) + ' ₫';

function getMonthLabel(y: number, m: number) {
  return `T${String(m + 1).padStart(2, '0')}/${y}`;
}

function getLast6Months(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: getMonthLabel(d.getFullYear(), d.getMonth()) });
  }
  return months;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  payroll: { label: 'Lương nhân viên', color: '#3B82F6', icon: '💼' },
  settlement: { label: 'Freelancer', color: '#8B5CF6', icon: '🎨' },
  invoice: { label: 'Doanh thu dự án', color: '#10B981', icon: '💰' },
  manual: { label: 'Chi phí thủ công', color: '#F59E0B', icon: '📝' },
};

// ---- Component ----
const ExpenseDashboard: React.FC<Props> = ({ expenses, categories, isLoading, onNavigateToList, onRefresh, vcbAvgRate }) => {
  const toVND = (amount: number, currency: string) => currency === 'USD' ? amount * vcbAvgRate : amount;
  const months = useMemo(() => getLast6Months(), []);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDayOfMonth = now.getDate();
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthProgress = Math.round((currentDayOfMonth / daysInCurrentMonth) * 100);

  const [syncing, setSyncing] = useState(false);

  const handleSyncRevenue = async () => {
    setSyncing(true);
    try {
      const result = await syncInvoiceRevenue();
      alert(`Đồng bộ hoàn tất: ${result.inserted} mới, ${result.updated} cập nhật`);
      onRefresh?.();
    } catch (e: any) {
      alert('Lỗi sync: ' + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  // ── Split revenue vs expense ──
  const allExpenses = useMemo(() => expenses.filter(e => e.type !== 'revenue'), [expenses]);
  const allRevenue = useMemo(() => expenses.filter(e => e.type === 'revenue'), [expenses]);

  // ── This month data ──
  const filterMonth = (items: ExpenseRecord[], month: number, year: number) =>
    items.filter(e => { const d = new Date(e.expense_date); return d.getMonth() === month && d.getFullYear() === year; });

  const thisExpenses = useMemo(() => filterMonth(allExpenses, currentMonth, currentYear), [allExpenses, currentMonth, currentYear]);
  const thisRevenue = useMemo(() => filterMonth(allRevenue, currentMonth, currentYear), [allRevenue, currentMonth, currentYear]);

  const thisExpTotal = thisExpenses.reduce((s, e) => s + toVND(e.amount, e.currency), 0);
  const thisRevTotal = thisRevenue.reduce((s, e) => s + toVND(e.amount, e.currency), 0);

  // ── Monthly P&L data for chart ──
  const monthlyPL = useMemo(() => {
    return months.map(m => {
      const mExpenses = filterMonth(allExpenses, m.month, m.year);
      const mRevenue = filterMonth(allRevenue, m.month, m.year);
      const expVND = mExpenses.reduce((s, e) => s + toVND(e.amount, e.currency), 0);
      const revVND = mRevenue.reduce((s, e) => s + toVND(e.amount, e.currency), 0);
      return { ...m, expVND, revVND, profitVND: revVND - expVND };
    });
  }, [allExpenses, allRevenue, months, vcbAvgRate]);

  const maxBar = Math.max(...monthlyPL.map(m => Math.max(m.expVND, m.revVND)), 1);

  // ── Source breakdown (expense only, all converted to VND) ──
  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    allExpenses.forEach(e => {
      const key = e.source_type || 'manual';
      map.set(key, (map.get(key) || 0) + toVND(e.amount, e.currency));
    });
    return [...map.entries()].map(([key, total]) => ({
      key,
      ...(SOURCE_LABELS[key] || { label: key, color: '#6B7280', icon: '📦' }),
      total,
    })).sort((a, b) => b.total - a.total);
  }, [allExpenses, vcbAvgRate]);

  const totalSourceVND = sourceData.reduce((s, c) => s + c.total, 0);

  // ── Top 5 expenses — sort by VND-converted amount ──
  const topExpenses = useMemo(() =>
    [...allExpenses]
      .sort((a, b) => toVND(b.amount, b.currency) - toVND(a.amount, a.currency))
      .slice(0, 5),
    [allExpenses, vcbAvgRate]);

  // ── Auto-synced count ──
  const autoSyncedCount = expenses.filter(e => e.source_type && e.source_type !== 'manual').length;

  if (isLoading) {
    return (
      <div className="animate-fadeInUp py-20 text-center flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6 animate-pulse">
          <svg className="w-10 h-10 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <p className="opacity-50 font-black uppercase tracking-widest text-xs">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-0 md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Financial Hub</h2>
          <p className="text-neutral-medium text-sm mt-2">Tổng quan tài chính • {months[months.length - 1].label}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {autoSyncedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400">{autoSyncedCount} auto-synced</span>
            </div>
          )}
          <button
            onClick={handleSyncRevenue}
            disabled={syncing}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50"
          >
            {syncing ? '⟳ Đang sync…' : '🔄 Sync doanh thu'}
          </button>
          <button onClick={onNavigateToList}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-primary/20 text-primary hover:bg-primary/5 transition-all">
            📋 Xem danh sách
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Revenue VND */}
        <div className="p-5 rounded-[20px] border bg-surface border-emerald-500/20 transition-all hover:border-emerald-500/40 group">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-2">💰 Doanh thu tháng này</p>
          <p className="text-2xl font-black text-emerald-400 tabular-nums">{thisRevTotal > 0 ? fmtVND(thisRevTotal) : '—'}</p>
          <p className="text-[10px] text-neutral-medium mt-2">Tổng: {allRevenue.length} giao dịch</p>
        </div>

        {/* Expense VND */}
        <div className="p-5 rounded-[20px] border bg-surface border-red-500/20 transition-all hover:border-red-500/40 group">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400/80 mb-2">📤 Chi phí tháng này</p>
          <p className="text-2xl font-black text-red-400 tabular-nums">{thisExpTotal > 0 ? fmtVND(thisExpTotal) : '—'}</p>
          <p className="text-[10px] text-neutral-medium mt-2">Tổng: {allExpenses.length} giao dịch</p>
        </div>

        {/* Profit/Loss */}
        <div className="p-5 rounded-[20px] border bg-surface border-primary/10 transition-all hover:border-primary/25 group">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">📊 Lợi nhuận tháng này</p>
          {(() => {
            const profit = thisRevTotal - thisExpTotal;
            return (
              <>
                <p className={`text-2xl font-black tabular-nums ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {profit >= 0 ? '+' : ''}{fmtVND(profit)}
                </p>
                <p className="text-[10px] text-neutral-medium mt-2">
                  {profit >= 0 ? '▲ Có lãi' : '▼ Lỗ'} tháng này
                </p>
              </>
            );
          })()}
        </div>

        {/* Sources */}
        <div className="p-5 rounded-[20px] border bg-surface border-primary/10 transition-all hover:border-primary/25 group">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">🔗 Nguồn dữ liệu</p>
          <div className="space-y-1.5 mt-1">
            {[
              { label: 'Payroll', count: expenses.filter(e => e.source_type === 'payroll').length, color: '#3B82F6' },
              { label: 'Freelancer', count: expenses.filter(e => e.source_type === 'settlement').length, color: '#8B5CF6' },
              { label: 'Invoice', count: expenses.filter(e => e.source_type === 'invoice').length, color: '#10B981' },
              { label: 'Manual', count: expenses.filter(e => !e.source_type).length, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] font-bold text-white/70">{s.label}</span>
                </div>
                <span className="text-[10px] font-bold text-white/50 tabular-nums">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monthly Revenue vs Expense Chart + Source Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* P&L Bar Chart — 3 cols */}
        <div className="lg:col-span-3 rounded-[20px] border bg-surface border-primary/10 p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">Doanh thu vs Chi phí 6 tháng (VND)</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-emerald-400" /><span className="text-[9px] text-neutral-medium">Doanh thu</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-red-400" /><span className="text-[9px] text-neutral-medium">Chi phí</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-amber-400 opacity-70" style={{ border: '1px dashed #F59E0B' }} /><span className="text-[9px] text-neutral-medium">Đang chạy</span></div>
            </div>
          </div>
          {monthlyPL.every(m => m.expVND === 0 && m.revVND === 0) ? (
            <div className="py-10 text-center">
              <p className="text-neutral-medium text-sm">Chưa có dữ liệu VND</p>
            </div>
          ) : (
            <div className="space-y-4">
              {monthlyPL.map((m, i) => {
                const isCurrentMonth = m.month === currentMonth && m.year === currentYear;
                const revPct = maxBar > 0 ? (m.revVND / maxBar * 100) : 0;
                const expPct = maxBar > 0 ? (m.expVND / maxBar * 100) : 0;
                return (
                  <div key={i} className="group/bar">
                    <div className="flex items-center gap-3">
                      <div className="w-16 flex-shrink-0">
                        <span className={`text-[11px] font-bold tabular-nums block ${isCurrentMonth ? 'text-amber-400' : 'text-neutral-medium'}`}>
                          {m.label}
                        </span>
                        {isCurrentMonth && (
                          <span className="text-[8px] font-bold text-amber-400/60">{monthProgress}% tháng</span>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        {/* Revenue bar */}
                        <div className={`h-3.5 rounded-md overflow-hidden relative ${isCurrentMonth ? 'bg-amber-500/5 border border-amber-500/10 border-dashed' : 'bg-white/[0.02]'}`}>
                          <div className={`h-full rounded-md transition-all duration-700 ${isCurrentMonth ? 'bg-gradient-to-r from-amber-500/50 to-amber-400/70' : 'bg-gradient-to-r from-emerald-500/60 to-emerald-400/80'}`}
                            style={{ width: `${Math.max(revPct, revPct > 0 ? 2 : 0)}%`, animation: `barGrow 0.8s ease-out ${i * 0.1}s both` }} />
                          {m.revVND > 0 && <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold tabular-nums opacity-0 group-hover/bar:opacity-100 transition-opacity ${isCurrentMonth ? 'text-amber-300/60' : 'text-emerald-300/60'}`}>+{fmt(m.revVND)}</span>}
                        </div>
                        {/* Expense bar */}
                        <div className={`h-3.5 rounded-md overflow-hidden relative ${isCurrentMonth ? 'bg-orange-500/5 border border-orange-500/10 border-dashed' : 'bg-white/[0.02]'}`}>
                          <div className={`h-full rounded-md transition-all duration-700 ${isCurrentMonth ? 'bg-gradient-to-r from-orange-500/50 to-orange-400/70' : 'bg-gradient-to-r from-red-500/60 to-red-400/80'}`}
                            style={{ width: `${Math.max(expPct, expPct > 0 ? 2 : 0)}%`, animation: `barGrow 0.8s ease-out ${i * 0.1 + 0.05}s both` }} />
                          {m.expVND > 0 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-300/60 tabular-nums opacity-0 group-hover/bar:opacity-100 transition-opacity">-{fmt(m.expVND)}</span>}
                        </div>
                      </div>
                      <div className="w-24 text-right flex-shrink-0">
                        <span className={`text-[10px] font-bold tabular-nums ${
                          isCurrentMonth ? 'text-amber-400/70' : m.profitVND > 0 ? 'text-emerald-400' : m.profitVND < 0 ? 'text-red-400' : 'text-white/40'
                        }`}>
                          {m.profitVND !== 0 ? (m.profitVND > 0 ? '+' : '') + fmt(m.profitVND) : '—'}
                        </span>
                        {isCurrentMonth && <p className="text-[8px] text-amber-400/40 mt-0.5">partial</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source Breakdown — 2 cols */}
        <div className="lg:col-span-2 rounded-[20px] border bg-surface border-primary/10 p-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-6">Phân bổ chi phí theo nguồn</h3>
          {sourceData.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-neutral-medium text-sm">Chưa có dữ liệu</p>
            </div>
          ) : (
            <>
              {/* Stacked Bar */}
              <div className="h-4 rounded-full overflow-hidden flex mb-6">
                {sourceData.map((c, i) => {
                  const pct = totalSourceVND > 0 ? (c.total / totalSourceVND * 100) : 0;
                  return (
                    <div key={i} className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: c.color, opacity: 0.8, animation: `barGrow 0.6s ease-out ${i * 0.1}s both` }}
                      title={`${c.icon} ${c.label}: ${fmt(c.total)} ₫ (${pct.toFixed(1)}%)`} />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {sourceData.map((c, i) => {
                  const pct = totalSourceVND > 0 ? (c.total / totalSourceVND * 100) : 0;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-xs font-bold text-white truncate">{c.icon} {c.label}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[10px] font-bold text-neutral-medium tabular-nums">{pct.toFixed(1)}%</span>
                        <span className="text-xs font-bold text-white/70 tabular-nums">{fmt(c.total)} ₫</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── P&L Monthly Report Table ── */}
      <div className="rounded-[20px] border bg-surface border-primary/10 p-6 overflow-x-auto">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-6">📋 Báo cáo P&L theo tháng</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-2 font-black text-white/60 uppercase tracking-wider text-[10px]">Kỳ</th>
              <th className="text-right py-3 px-2 font-black text-emerald-400/60 uppercase tracking-wider text-[10px]">Doanh thu</th>
              <th className="text-right py-3 px-2 font-black text-blue-400/60 uppercase tracking-wider text-[10px]">Lương</th>
              <th className="text-right py-3 px-2 font-black text-purple-400/60 uppercase tracking-wider text-[10px]">Freelancer</th>
              <th className="text-right py-3 px-2 font-black text-amber-400/60 uppercase tracking-wider text-[10px]">Khác</th>
              <th className="text-right py-3 px-2 font-black text-white/60 uppercase tracking-wider text-[10px]">Lợi nhuận</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Build monthly P&L data with source breakdown
              return months.map((m, i) => {
                const mItems = expenses.filter(e => {
                  const d = new Date(e.expense_date);
                  return d.getMonth() === m.month && d.getFullYear() === m.year;
                });
                const revTotal = mItems.filter(e => e.type === 'revenue').reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                const payTotal = mItems.filter(e => e.source_type === 'payroll').reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                const freeTotal = mItems.filter(e => e.source_type === 'settlement').reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                const manualTotal = mItems.filter(e => e.type !== 'revenue' && !e.source_type).reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                const totalCost = payTotal + freeTotal + manualTotal;
                const profit = revTotal - totalCost;
                const isCurrentMonth = m.month === currentMonth && m.year === currentYear;
                const hasData = mItems.length > 0;

                return (
                  <tr key={i} className={`border-b border-white/5 transition-colors ${isCurrentMonth ? 'bg-white/[0.03]' : ''} ${hasData ? '' : 'opacity-30'}`}>
                    <td className={`py-3 px-2 font-bold tabular-nums ${isCurrentMonth ? 'text-amber-400' : 'text-white/70'}`}>
                      {m.label}
                      {isCurrentMonth && <span className="ml-1.5 text-[8px] font-bold text-amber-400/50 border border-amber-500/20 px-1 py-0.5 rounded">~{monthProgress}%</span>}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-emerald-400 font-bold">
                      {revTotal > 0 ? fmtVND(revTotal) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-blue-400 font-bold">
                      {payTotal > 0 ? fmtVND(payTotal) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-purple-400 font-bold">
                      {freeTotal > 0 ? fmtVND(freeTotal) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-amber-400 font-bold">
                      {manualTotal > 0 ? fmtVND(manualTotal) : '—'}
                    </td>
                    <td className="py-3 px-2 text-right font-black tabular-nums">
                      {profit !== 0 ? (
                        <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {profit >= 0 ? '+' : ''}{fmtVND(profit)}
                        </span>
                      ) : <span className="text-white/30">—</span>}
                    </td>
                  </tr>
                );
              });
            })()}
            {/* Totals Row */}
            <tr className="border-t-2 border-white/20 font-black">
              <td className="py-3 px-2 text-primary uppercase text-[10px] tracking-widest">Tổng cộng</td>
              <td className="py-3 px-2 text-right tabular-nums text-emerald-400">
                {fmtVND(allRevenue.reduce((s, e) => s + toVND(e.amount, e.currency), 0))}
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-blue-400">
                {fmtVND(allExpenses.filter(e => e.source_type === 'payroll').reduce((s, e) => s + toVND(e.amount, e.currency), 0))}
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-purple-400">
                {fmtVND(allExpenses.filter(e => e.source_type === 'settlement').reduce((s, e) => s + toVND(e.amount, e.currency), 0))}
              </td>
              <td className="py-3 px-2 text-right tabular-nums text-amber-400">
                {fmtVND(allExpenses.filter(e => !e.source_type).reduce((s, e) => s + toVND(e.amount, e.currency), 0))}
              </td>
              <td className="py-3 px-2 text-right tabular-nums">
                {(() => {
                  const totRev = allRevenue.reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                  const totExp = allExpenses.reduce((s, e) => s + toVND(e.amount, e.currency), 0);
                  const p = totRev - totExp;
                  return <span className={p >= 0 ? 'text-emerald-400' : 'text-red-400'}>{p >= 0 ? '+' : ''}{fmtVND(p)}</span>;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Revenue Breakdown (all in VND) ── */}
      {allRevenue.length > 0 && (
        <div className="rounded-[20px] border bg-surface border-emerald-500/10 p-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-6">💵 Revenue Breakdown</h3>
          <div className="space-y-3">
            {(() => {
              const clientMap = new Map<string, number>();
              allRevenue.forEach(e => {
                const key = e.client_name || e.vendor || 'Unknown';
                clientMap.set(key, (clientMap.get(key) || 0) + toVND(e.amount, e.currency));
              });
              const clientData = [...clientMap.entries()].sort((a, b) => b[1] - a[1]);
              const maxClient = Math.max(...clientData.map(c => c[1]), 1);
              return clientData.map(([client, amount], i) => (
                <div key={i} className="group/item">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/80 truncate">{client}</span>
                    <span className="text-xs font-black text-emerald-400 tabular-nums">{fmtVND(amount)}</span>
                  </div>
                  <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/50 to-emerald-400/70 transition-all duration-700"
                      style={{ width: `${(amount / maxClient * 100)}%`, animation: `barGrow 0.6s ease-out ${i * 0.1}s both` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ── Top 5 Expenses ── */}
      <div className="rounded-[20px] border bg-surface border-primary/10 p-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-6">Top 5 chi phí lớn nhất</h3>
        {topExpenses.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-neutral-medium text-sm">Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {topExpenses.map((exp, i) => (
              <div key={exp.id} className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/[0.03] transition-colors group">
                <span className="text-lg font-black text-white/20 tabular-nums w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{exp.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-neutral-medium tabular-nums">{exp.expense_date}</span>
                    {exp.source_type && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{
                        backgroundColor: (SOURCE_LABELS[exp.source_type]?.color || '#6B7280') + '15',
                        color: SOURCE_LABELS[exp.source_type]?.color || '#6B7280'
                      }}>
                        {SOURCE_LABELS[exp.source_type]?.icon} {SOURCE_LABELS[exp.source_type]?.label || exp.source_type}
                      </span>
                    )}
                    {exp.category && !exp.source_type && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: exp.category.color + '15', color: exp.category.color }}>
                        {exp.category.icon} {exp.category.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-red-400 tabular-nums">
                    {fmtVND(toVND(exp.amount, exp.currency))}
                  </p>
                  {exp.currency !== 'VND' && (
                    <p className="text-[9px] font-bold text-neutral-medium/60 tabular-nums">
                      {exp.currency === 'USD' ? '$' : ''}{exp.amount.toLocaleString('en-US')} {exp.currency}
                    </p>
                  )}
                  <p className="text-[9px] font-bold text-neutral-medium">{exp.vendor || exp.client_name || '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes barGrow {
          from { width: 0%; opacity: 0; }
          to { opacity: 1; }
        }
      `}
      </style>
    </div>
  );
};

export default ExpenseDashboard;
