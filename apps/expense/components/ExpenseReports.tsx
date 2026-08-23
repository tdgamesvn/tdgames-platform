import React, { useState, useEffect, useMemo } from 'react';
import { ExpenseRecord, ExpenseCategory } from '@/types';
import { BudgetRecord, fetchBudgets, saveBudget, deleteBudget, exportToCSV } from '../services/expenseService';

interface Props {
  expenses: ExpenseRecord[];
  categories: ExpenseCategory[];
}

const fmt = (n: number) => n.toLocaleString('vi-VN');
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2 });

const ExpenseReports: React.FC<Props> = ({ expenses, categories }) => {
  const now = new Date();
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [formMonth, setFormMonth] = useState(now.getMonth() + 1);
  const [formCat, setFormCat] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCurrency, setFormCurrency] = useState<'VND' | 'USD'>('VND');
  const [formLabel, setFormLabel] = useState('');

  useEffect(() => { fetchBudgets(selectedYear).then(setBudgets).catch(console.error); }, [selectedYear]);

  const handleSaveBudget = async () => {
    if (!formAmount) return;
    await saveBudget({ month: formMonth, year: selectedYear, category_id: formCat || null, label: formLabel, amount: parseFloat(formAmount), currency: formCurrency, notes: '' });
    setBudgets(await fetchBudgets(selectedYear));
    setShowBudgetForm(false); setFormAmount(''); setFormLabel('');
  };

  const handleDeleteBudget = async (id: string) => {
    await deleteBudget(id);
    setBudgets(await fetchBudgets(selectedYear));
  };

  // ── Budget vs Actual per month ──
  const budgetComparison = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mBudgets = budgets.filter(b => b.month === month);
      const mExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date);
        return d.getMonth() === i && d.getFullYear() === selectedYear && e.type !== 'revenue';
      });
      const budgetVND = mBudgets.filter(b => b.currency === 'VND').reduce((s, b) => s + b.amount, 0);
      const budgetUSD = mBudgets.filter(b => b.currency === 'USD').reduce((s, b) => s + b.amount, 0);
      const actualVND = mExpenses.filter(e => e.currency === 'VND').reduce((s, e) => s + e.amount, 0);
      const actualUSD = mExpenses.filter(e => e.currency === 'USD').reduce((s, e) => s + e.amount, 0);
      return { month, budgetVND, budgetUSD, actualVND, actualUSD, label: `T${String(month).padStart(2, '0')}` };
    });
  }, [budgets, expenses, selectedYear]);

  // ── Forecast: Simple 3-month trend projection ──
  const forecast = useMemo(() => {
    const lastMonths = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mExp = expenses.filter(e => {
        const ed = new Date(e.expense_date);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      });
      return {
        label: `T${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        revUSD: mExp.filter(e => e.type === 'revenue' && e.currency === 'USD').reduce((s, e) => s + e.amount, 0),
        expVND: mExp.filter(e => e.type !== 'revenue' && e.currency === 'VND').reduce((s, e) => s + e.amount, 0),
        expUSD: mExp.filter(e => e.type !== 'revenue' && e.currency === 'USD').reduce((s, e) => s + e.amount, 0),
        actual: true,
      };
    }).reverse();

    const nonZero = lastMonths.filter(m => m.revUSD > 0 || m.expVND > 0);
    if (nonZero.length < 2) return { history: lastMonths, projected: [] };

    const avgRevUSD = nonZero.reduce((s, m) => s + m.revUSD, 0) / nonZero.length;
    const avgExpVND = nonZero.reduce((s, m) => s + m.expVND, 0) / nonZero.length;
    const avgExpUSD = nonZero.reduce((s, m) => s + m.expUSD, 0) / nonZero.length;

    const projected = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      return {
        label: `T${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
        revUSD: Math.round(avgRevUSD * 100) / 100,
        expVND: Math.round(avgExpVND),
        expUSD: Math.round(avgExpUSD * 100) / 100,
        actual: false,
      };
    });

    return { history: lastMonths, projected };
  }, [expenses]);

  const allForecast = [...forecast.history, ...forecast.projected];
  const maxForecast = Math.max(...allForecast.map(m => m.revUSD), 1);

  return (
    <div className="animate-fadeInUp space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Reports</h2>
          <p className="text-neutral-medium text-sm mt-2">Budget • Forecast • Export</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
            className="bg-surface border border-primary/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/30">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => exportToCSV(expenses, `PL_Report_${selectedYear}.csv`)}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ═══ BUDGET TRACKER ═══ */}
      <div className="rounded-[20px] border bg-surface border-primary/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium">💰 Budget vs Thực tế — {selectedYear}</h3>
          <button onClick={() => setShowBudgetForm(!showBudgetForm)}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all">
            {showBudgetForm ? '✕ Đóng' : '＋ Thêm Budget'}
          </button>
        </div>

        {/* Budget Form */}
        {showBudgetForm && (
          <div className="mb-6 p-4 rounded-xl bg-white/[0.03] border border-primary/10 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase block mb-1">Tháng</label>
              <select value={formMonth} onChange={e => setFormMonth(+e.target.value)}
                className="w-full bg-surface border border-primary/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase block mb-1">Danh mục</label>
              <select value={formCat} onChange={e => setFormCat(e.target.value)}
                className="w-full bg-surface border border-primary/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                <option value="">Tổng chung</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase block mb-1">Nhãn</label>
              <input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="VD: Chi phí vận hành"
                className="w-full bg-surface border border-primary/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase block mb-1">Số tiền</label>
              <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0"
                className="w-full bg-surface border border-primary/10 rounded-lg px-3 py-2 text-sm text-white outline-none tabular-nums" />
            </div>
            <div>
              <label className="text-[9px] font-bold text-white/40 uppercase block mb-1">Tiền tệ</label>
              <select value={formCurrency} onChange={e => setFormCurrency(e.target.value as 'VND' | 'USD')}
                className="w-full bg-surface border border-primary/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <button onClick={handleSaveBudget}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase bg-primary/20 text-primary hover:bg-primary/30 transition-all">
              💾 Lưu
            </button>
          </div>
        )}

        {/* Budget Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-2 text-[10px] font-black text-white/50 uppercase">Tháng</th>
                <th className="text-right py-2 px-2 text-[10px] font-black text-blue-400/60 uppercase">Budget VND</th>
                <th className="text-right py-2 px-2 text-[10px] font-black text-primary/60 uppercase">Thực tế VND</th>
                <th className="text-right py-2 px-2 text-[10px] font-black text-white/50 uppercase">Chênh lệch</th>
                <th className="text-center py-2 px-2 text-[10px] font-black text-white/50 uppercase">Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {budgetComparison.filter(m => m.budgetVND > 0 || m.actualVND > 0).map(m => {
                const diff = m.budgetVND - m.actualVND;
                const pct = m.budgetVND > 0 ? (m.actualVND / m.budgetVND * 100) : 0;
                const over = pct > 100;
                return (
                  <tr key={m.month} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 px-2 font-bold text-white/70">{m.label}/{selectedYear}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-blue-400 font-bold">{m.budgetVND > 0 ? fmt(m.budgetVND) + ' ₫' : '—'}</td>
                    <td className="py-3 px-2 text-right tabular-nums text-primary font-bold">{m.actualVND > 0 ? fmt(m.actualVND) + ' ₫' : '—'}</td>
                    <td className={`py-3 px-2 text-right tabular-nums font-black ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.budgetVND > 0 ? (diff >= 0 ? '+' : '') + fmt(diff) + ' ₫' : '—'}
                    </td>
                    <td className="py-3 px-2">
                      {m.budgetVND > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${over ? 'bg-red-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className={`text-[9px] font-bold tabular-nums ${over ? 'text-red-400' : 'text-emerald-400'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {budgetComparison.every(m => m.budgetVND === 0 && m.actualVND === 0) && (
                <tr><td colSpan={5} className="py-8 text-center text-neutral-medium text-sm">Chưa có budget nào cho {selectedYear}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Budget items list */}
        {budgets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Các budget đã thiết lập</p>
            <div className="flex flex-wrap gap-2">
              {budgets.map(b => (
                <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 group">
                  <span className="text-[10px] font-bold text-white/60">T{String(b.month).padStart(2, '0')}</span>
                  <span className="text-[10px] font-bold text-primary tabular-nums">{b.currency === 'VND' ? fmt(b.amount) + '₫' : fmtUSD(b.amount)}</span>
                  {b.label && <span className="text-[9px] text-white/30">{b.label}</span>}
                  <button onClick={() => handleDeleteBudget(b.id!)} className="text-red-500/30 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ FORECAST ═══ */}
      <div className="rounded-[20px] border bg-surface border-primary/10 p-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-2">📈 Dự báo doanh thu 3 tháng tới (USD)</h3>
        <p className="text-[9px] text-white/30 mb-6">Dựa trên trung bình {forecast.history.filter(m => m.revUSD > 0).length} tháng có dữ liệu</p>

        {allForecast.every(m => m.revUSD === 0) ? (
          <p className="py-8 text-center text-neutral-medium text-sm">Chưa đủ dữ liệu doanh thu để dự báo</p>
        ) : (
          <div className="space-y-3">
            {allForecast.map((m, i) => {
              const pct = maxForecast > 0 ? (m.revUSD / maxForecast * 100) : 0;
              return (
                <div key={i} className="group/bar">
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-bold tabular-nums w-20 flex-shrink-0 ${!m.actual ? 'text-amber-400 italic' : 'text-white/60'}`}>
                      {m.label} {!m.actual && '⟡'}
                    </span>
                    <div className="flex-1 h-4 bg-white/[0.02] rounded-md overflow-hidden relative">
                      <div className={`h-full rounded-md transition-all duration-700 ${m.actual ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400/80' : 'bg-gradient-to-r from-amber-500/40 to-amber-400/60 border border-amber-500/20 border-dashed'}`}
                        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }} />
                      {m.revUSD > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white/50 tabular-nums">{fmtUSD(m.revUSD)}</span>
                      )}
                    </div>
                    {!m.actual && <span className="text-[8px] font-bold text-amber-400/60 uppercase">Forecast</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Forecast Summary */}
        {forecast.projected.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-[9px] font-black uppercase text-amber-400/60 mb-1">Doanh thu dự kiến (3T)</p>
              <p className="text-lg font-black text-amber-400 tabular-nums">{fmtUSD(forecast.projected.reduce((s, m) => s + m.revUSD, 0))}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-[9px] font-black uppercase text-red-400/60 mb-1">Chi phí dự kiến VND (3T)</p>
              <p className="text-lg font-black text-red-400 tabular-nums">{fmt(forecast.projected.reduce((s, m) => s + m.expVND, 0))} ₫</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[9px] font-black uppercase text-emerald-400/60 mb-1">Lợi nhuận USD dự kiến</p>
              <p className="text-lg font-black text-emerald-400 tabular-nums">
                {fmtUSD(forecast.projected.reduce((s, m) => s + (m.revUSD - m.expUSD), 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ EXPORT OPTIONS ═══ */}
      <div className="rounded-[20px] border bg-surface border-primary/10 p-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-6">📥 Xuất báo cáo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => exportToCSV(expenses, `Full_Financial_Report_${selectedYear}.csv`)}
            className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-primary/30 transition-all text-left group">
            <p className="text-sm font-black text-white group-hover:text-primary transition-colors">📊 Báo cáo tổng hợp</p>
            <p className="text-[10px] text-white/40 mt-1">Toàn bộ giao dịch ({expenses.length} records)</p>
          </button>
          <button onClick={() => exportToCSV(expenses.filter(e => e.type === 'revenue'), `Revenue_Report_${selectedYear}.csv`)}
            className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/30 transition-all text-left group">
            <p className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">💰 Báo cáo doanh thu</p>
            <p className="text-[10px] text-white/40 mt-1">Chỉ doanh thu ({expenses.filter(e => e.type === 'revenue').length} records)</p>
          </button>
          <button onClick={() => exportToCSV(expenses.filter(e => e.type !== 'revenue'), `Expense_Report_${selectedYear}.csv`)}
            className="p-5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/30 transition-all text-left group">
            <p className="text-sm font-black text-white group-hover:text-red-400 transition-colors">📤 Báo cáo chi phí</p>
            <p className="text-[10px] text-white/40 mt-1">Chỉ chi phí ({expenses.filter(e => e.type !== 'revenue').length} records)</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseReports;
