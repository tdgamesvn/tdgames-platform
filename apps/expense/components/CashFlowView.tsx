import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ExpenseRecord } from '@/types';
import { supabase } from '@/services/supabaseClient';

interface Props {
  expenses: ExpenseRecord[];
  vcbAvgRate: number;
}

interface PaidInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  paid_date: string;
  currency: string;
  items: { quantity: number; unitPrice: number }[];
}

interface MonthData {
  key: string;       // 'YYYY-MM'
  label: string;     // 'T01/2025'
  cashIn: number;    // VND
  cashOut: number;   // VND
  net: number;       // VND
  cumulative: number; // VND
  invoiceCount: number;
  expenseCount: number;
}

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' tỷ';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' tr';
  return n.toLocaleString('vi-VN');
};
const fmtFull = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' ₫';

function getMonthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
function getMonthLabel(y: number, m: number) {
  return `T${String(m + 1).padStart(2, '0')}/${y}`;
}

function calcInvoiceTotal(inv: PaidInvoice): number {
  return (inv.items || []).reduce((s, item) => s + (item.quantity || 0) * (item.unitPrice || 0), 0);
}

const MONTH_NAMES = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

const CashFlowView: React.FC<Props> = ({ expenses, vcbAvgRate }) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  const toVND = useCallback((amount: number, currency: string) =>
    currency === 'USD' ? amount * vcbAvgRate : amount, [vcbAvgRate]);

  // ── Fetch paid invoices for selected year ──
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const from = `${selectedYear}-01-01`;
        const to = `${selectedYear}-12-31`;
        const { data, error } = await supabase
          .from('invoice_invoices')
          .select('id, invoice_number, client_name, paid_date, currency, items')
          .eq('status', 'paid')
          .gte('paid_date', from)
          .lte('paid_date', to)
          .order('paid_date');
        if (error) throw error;
        setPaidInvoices(data || []);
      } catch (e) {
        console.error('CashFlow fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [selectedYear]);

  // ── Build monthly data ──
  const monthlyData: MonthData[] = useMemo(() => {
    const map: Record<string, { cashIn: number; cashOut: number; invoiceCount: number; expenseCount: number }> = {};

    // Init all 12 months
    for (let m = 0; m < 12; m++) {
      map[getMonthKey(selectedYear, m)] = { cashIn: 0, cashOut: 0, invoiceCount: 0, expenseCount: 0 };
    }

    // Cash IN from paid invoices
    paidInvoices.forEach(inv => {
      if (!inv.paid_date) return;
      const d = new Date(inv.paid_date);
      if (d.getFullYear() !== selectedYear) return;
      const key = getMonthKey(selectedYear, d.getMonth());
      if (!map[key]) return;
      const total = calcInvoiceTotal(inv);
      map[key].cashIn += toVND(total, inv.currency);
      map[key].invoiceCount++;
    });

    // Cash OUT from expenses (exclude revenue type)
    expenses.forEach(exp => {
      if (exp.type === 'revenue') return;
      const d = new Date(exp.expense_date);
      if (d.getFullYear() !== selectedYear) return;
      const key = getMonthKey(selectedYear, d.getMonth());
      if (!map[key]) return;
      map[key].cashOut += toVND(exp.amount, exp.currency);
      map[key].expenseCount++;
    });

    // Build sorted array with cumulative
    let cumulative = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const key = getMonthKey(selectedYear, i);
      const { cashIn, cashOut, invoiceCount, expenseCount } = map[key];
      const net = cashIn - cashOut;
      cumulative += net;
      return {
        key, label: getMonthLabel(selectedYear, i),
        cashIn, cashOut, net, cumulative, invoiceCount, expenseCount,
      };
    });
  }, [paidInvoices, expenses, selectedYear, toVND]);

  // ── Totals ──
  const totalCashIn = monthlyData.reduce((s, m) => s + m.cashIn, 0);
  const totalCashOut = monthlyData.reduce((s, m) => s + m.cashOut, 0);
  const totalNet = totalCashIn - totalCashOut;

  // ── Bar chart scale ──
  const maxBar = Math.max(...monthlyData.map(m => Math.max(m.cashIn, m.cashOut, 1)));
  const maxAbs = Math.max(Math.abs(totalNet), 1);

  // ── Available years ──
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const currentMonthIdx = now.getFullYear() === selectedYear ? now.getMonth() : -1;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">💵 Dòng tiền</h2>
          <p className="text-gray-400 text-sm mt-1">
            Tiền vào (hoá đơn đã thu) vs Tiền ra (chi phí) — quy đổi VND
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && <span className="text-gray-400 text-sm animate-pulse">Đang tải...</span>}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">💚 Tổng thu</div>
          <div className="text-2xl font-bold text-emerald-300">{fmt(totalCashIn)}</div>
          <div className="text-emerald-400/60 text-xs mt-1">{paidInvoices.length} hoá đơn đã thu</div>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">❤️ Tổng chi</div>
          <div className="text-2xl font-bold text-red-300">{fmt(totalCashOut)}</div>
          <div className="text-red-400/60 text-xs mt-1">
            {expenses.filter(e => e.type !== 'revenue' && new Date(e.expense_date).getFullYear() === selectedYear).length} khoản chi
          </div>
        </div>
        <div
          className="rounded-xl p-5"
          style={{
            background: totalNet >= 0 ? 'rgba(255,149,0,0.12)' : 'rgba(139,92,246,0.12)',
            border: `1px solid ${totalNet >= 0 ? 'rgba(255,149,0,0.3)' : 'rgba(139,92,246,0.3)'}`,
          }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: totalNet >= 0 ? '#FF9500' : '#a78bfa' }}>
            {totalNet >= 0 ? '🟠 Net dương' : '🟣 Net âm'}
          </div>
          <div className="text-2xl font-bold" style={{ color: totalNet >= 0 ? '#FF9500' : '#c4b5fd' }}>
            {totalNet >= 0 ? '+' : ''}{fmt(totalNet)}
          </div>
          <div className="text-xs mt-1 opacity-50" style={{ color: totalNet >= 0 ? '#FF9500' : '#c4b5fd' }}>
            Dòng tiền thuần {selectedYear}
          </div>
        </div>
      </div>

      {/* ── Bar Chart ── */}
      <div className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 className="text-white font-semibold mb-4 text-sm">📊 Biểu đồ theo tháng</h3>
        <div className="flex items-end gap-1 h-40">
          {monthlyData.map((m, i) => {
            const inH = maxBar > 0 ? (m.cashIn / maxBar) * 100 : 0;
            const outH = maxBar > 0 ? (m.cashOut / maxBar) * 100 : 0;
            const isCurrent = i === currentMonthIdx;
            return (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${m.label}\nThu: ${fmtFull(m.cashIn)}\nChi: ${fmtFull(m.cashOut)}\nNet: ${fmtFull(m.net)}`}>
                {/* Bars */}
                <div className="w-full flex items-end gap-0.5 h-32">
                  {/* Cash IN */}
                  <div
                    className="flex-1 rounded-t transition-all duration-300"
                    style={{
                      height: `${inH}%`,
                      background: isCurrent ? '#10B981' : 'rgba(16,185,129,0.6)',
                      minHeight: m.cashIn > 0 ? 2 : 0,
                    }}
                  />
                  {/* Cash OUT */}
                  <div
                    className="flex-1 rounded-t transition-all duration-300"
                    style={{
                      height: `${outH}%`,
                      background: isCurrent ? '#EF4444' : 'rgba(239,68,68,0.6)',
                      minHeight: m.cashOut > 0 ? 2 : 0,
                    }}
                  />
                </div>
                {/* Label */}
                <span className={`text-[9px] font-medium ${isCurrent ? 'text-orange-400' : 'text-gray-500'}`}>
                  {MONTH_NAMES[i]}
                </span>
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-gray-900 border border-white/20 rounded-lg p-2 text-xs whitespace-nowrap shadow-xl">
                    <div className="font-bold text-white mb-1">{m.label}</div>
                    <div className="text-emerald-400">↑ {fmtFull(m.cashIn)}</div>
                    <div className="text-red-400">↓ {fmtFull(m.cashOut)}</div>
                    <div className={`font-semibold mt-1 ${m.net >= 0 ? 'text-orange-400' : 'text-purple-400'}`}>
                      Net: {m.net >= 0 ? '+' : ''}{fmtFull(m.net)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,0.6)' }} />
            <span className="text-gray-400 text-xs">Thu (hoá đơn)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.6)' }} />
            <span className="text-gray-400 text-xs">Chi (expense)</span>
          </div>
        </div>
      </div>

      {/* ── Monthly Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.06)' }}>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Tháng</th>
                <th className="text-right py-3 px-4 text-emerald-400 font-medium">💚 Tiền vào</th>
                <th className="text-right py-3 px-4 text-red-400 font-medium">❤️ Tiền ra</th>
                <th className="text-right py-3 px-4 text-white font-medium">Net</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Luỹ kế</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium hidden sm:table-cell">HĐ / CP</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m, i) => {
                const isCurrent = i === currentMonthIdx;
                const isEmpty = m.cashIn === 0 && m.cashOut === 0;
                return (
                  <tr
                    key={m.key}
                    className="border-t transition-colors"
                    style={{
                      borderColor: 'rgba(255,255,255,0.05)',
                      background: isCurrent ? 'rgba(255,149,0,0.06)' : isEmpty ? 'transparent' : 'rgba(255,255,255,0.015)',
                      opacity: isEmpty && !isCurrent ? 0.4 : 1,
                    }}
                  >
                    <td className="py-3 px-4">
                      <span className={`font-medium ${isCurrent ? 'text-orange-400' : 'text-gray-300'}`}>
                        {m.label}
                        {isCurrent && <span className="ml-2 text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Hiện tại</span>}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-300 font-mono text-xs">
                      {m.cashIn > 0 ? fmt(m.cashIn) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-red-300 font-mono text-xs">
                      {m.cashOut > 0 ? fmt(m.cashOut) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold">
                      {isEmpty ? (
                        <span className="text-gray-600">—</span>
                      ) : (
                        <span className={m.net >= 0 ? 'text-orange-400' : 'text-purple-400'}>
                          {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs">
                      {/* Mini cumulative bar */}
                      <div className="flex items-center justify-end gap-2">
                        <div className="hidden sm:block w-16 h-1.5 rounded-full overflow-hidden bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(Math.abs(m.cumulative) / maxAbs * 100, 100)}%`,
                              background: m.cumulative >= 0 ? '#FF9500' : '#8B5CF6',
                            }}
                          />
                        </div>
                        <span className={isEmpty && m.cumulative === 0 ? 'text-gray-600' : m.cumulative >= 0 ? 'text-orange-300' : 'text-purple-300'}>
                          {isEmpty && m.cumulative === 0 ? '—' : (m.cumulative >= 0 ? '+' : '') + fmt(m.cumulative)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 text-xs hidden sm:table-cell">
                      {m.invoiceCount > 0 || m.expenseCount > 0
                        ? `${m.invoiceCount} HĐ / ${m.expenseCount} CP`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr style={{ background: 'rgba(255,255,255,0.06)', borderTop: '2px solid rgba(255,255,255,0.15)' }}>
                <td className="py-3 px-4 text-white font-bold text-xs uppercase tracking-wider">Cả năm</td>
                <td className="py-3 px-4 text-right text-emerald-300 font-bold font-mono text-xs">{fmt(totalCashIn)}</td>
                <td className="py-3 px-4 text-right text-red-300 font-bold font-mono text-xs">{fmt(totalCashOut)}</td>
                <td className="py-3 px-4 text-right font-bold font-mono text-xs">
                  <span className={totalNet >= 0 ? 'text-orange-400' : 'text-purple-400'}>
                    {totalNet >= 0 ? '+' : ''}{fmt(totalNet)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-xs">
                  <span className={totalNet >= 0 ? 'text-orange-300' : 'text-purple-300'}>
                    {totalNet >= 0 ? '+' : ''}{fmt(totalNet)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-gray-500 text-xs hidden sm:table-cell">
                  {paidInvoices.length} HĐ / {expenses.filter(e => e.type !== 'revenue' && new Date(e.expense_date).getFullYear() === selectedYear).length} CP
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Note ── */}
      <div className="text-xs text-gray-600 text-center pb-2">
        Tiền vào = hoá đơn trạng thái <em>paid</em> theo ngày thu · Tiền ra = chi phí đã ghi nhận · USD quy đổi theo tỷ giá VCB avg {vcbAvgRate > 0 ? `(${vcbAvgRate.toLocaleString('vi-VN')} đ/USD)` : ''}
      </div>
    </div>
  );
};

export default CashFlowView;
