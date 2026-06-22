import React, { useState, useMemo } from 'react';
import { ExpenseRecord } from '@/types';

interface Props {
  expenses: ExpenseRecord[];
  vcbRate: number; // VND per 1 USD, dùng để quy đổi USD sang VND
}

type Period = 'month' | 'quarter' | 'year' | 'all';

function getPeriodLabel(p: Period) {
  const now = new Date();
  if (p === 'month') return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  if (p === 'quarter') return `Q${Math.ceil((now.getMonth() + 1) / 3)}/${now.getFullYear()}`;
  if (p === 'year') return `Năm ${now.getFullYear()}`;
  return 'Tất cả';
}

function inPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === 'quarter') {
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const dq = Math.ceil((d.getMonth() + 1) / 3);
    return d.getFullYear() === now.getFullYear() && dq === q;
  }
  return true;
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

export default function PayablesTab({ expenses, vcbRate }: Props) {
  const rate = vcbRate || 25000;
  const [period, setPeriod] = useState<Period>('month');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  // Chỉ lấy expense (không phải revenue) trong kỳ
  const filtered = useMemo(() =>
    expenses.filter(e => (e.type || 'expense') === 'expense' && inPeriod(e.expense_date, period)),
    [expenses, period]
  );

  // Group by vendor
  const byVendor = useMemo(() => {
    const map = new Map<string, { vendor: string; rows: ExpenseRecord[]; payable: number; paid: number; outstanding: number }>();
    for (const exp of filtered) {
      const vendor = exp.vendor?.trim() || '(Không có nhà cung cấp)';
      if (!map.has(vendor)) map.set(vendor, { vendor, rows: [], payable: 0, paid: 0, outstanding: 0 });
      const entry = map.get(vendor)!;
      entry.rows.push(exp);
      // Quy đổi tất cả về VND
      const amt = exp.currency === 'VND' ? exp.amount : exp.amount * rate;
      if (exp.status === 'paid') { entry.paid += amt; }
      else { entry.payable += amt; entry.outstanding += amt; }
    }
    return Array.from(map.values()).sort((a, b) => b.payable + b.paid - (a.payable + a.paid));
  }, [filtered]);

  const totPayable = byVendor.reduce((s, v) => s + v.payable, 0);
  const totPaid = byVendor.reduce((s, v) => s + v.paid, 0);
  const totOutstanding = byVendor.reduce((s, v) => s + v.outstanding, 0);

  const PERIODS: Period[] = ['month', 'quarter', 'year', 'all'];

  const statusBadge = (status: string) => {
    const cfg: Record<string, string> = {
      pending: 'bg-yellow-500/15 text-yellow-300',
      approved: 'bg-blue-500/15 text-blue-300',
      paid: 'bg-emerald-500/15 text-emerald-300',
    };
    const label: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', paid: 'Đã trả' };
    return (
      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${cfg[status] || 'bg-white/10 text-neutral-400'}`}>
        {label[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>Công nợ phải trả (AP)</h2>
          <p className="text-neutral-medium text-sm mt-1">{getPeriodLabel(period)}</p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${period === p ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
              style={period === p ? { background: '#FF9500' } : {}}>
              {p === 'month' ? 'Tháng' : p === 'quarter' ? 'Quý' : p === 'year' ? 'Năm' : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tổng phát sinh', value: totPayable + totPaid, color: 'text-white' },
          { label: 'Đã thanh toán', value: totPaid, color: 'text-emerald-400' },
          { label: 'Còn tồn đọng', value: totOutstanding, color: 'text-orange-400' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1 text-neutral-600">{c.label}</p>
            <p className={`text-2xl font-black ${c.color}`}>{fmt(c.value)} <span className="text-xs font-normal text-neutral-500">VND</span></p>
          </div>
        ))}
      </div>

      {/* Vendor table */}
      {byVendor.length === 0 ? (
        <div className="text-center py-16 text-neutral-600 text-sm">Không có chi phí trong kỳ này</div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-neutral-500 text-xs uppercase tracking-wider">Nhà cung cấp</th>
                <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase tracking-wider">Phải trả</th>
                <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase tracking-wider">Đã trả</th>
                <th className="text-right px-5 py-3 text-neutral-500 text-xs uppercase tracking-wider">Còn nợ</th>
                <th className="text-center px-5 py-3 text-neutral-500 text-xs uppercase tracking-wider">Phiếu</th>
              </tr>
            </thead>
            <tbody>
              {byVendor.map(v => (
                <React.Fragment key={v.vendor}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                    onClick={() => setExpandedVendor(expandedVendor === v.vendor ? null : v.vendor)}
                  >
                    <td className="px-5 py-3 text-white font-semibold flex items-center gap-2">
                      <span className={`transition-transform text-neutral-500 text-xs ${expandedVendor === v.vendor ? 'rotate-90' : ''}`}>▶</span>
                      {v.vendor}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-300">{fmt(v.payable)}</td>
                    <td className="px-5 py-3 text-right text-emerald-400">{fmt(v.paid)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${v.outstanding > 0 ? 'text-orange-400' : 'text-neutral-500'}`}>{fmt(v.outstanding)}</td>
                    <td className="px-5 py-3 text-center text-neutral-400">{v.rows.length}</td>
                  </tr>
                  {expandedVendor === v.vendor && v.rows.map(row => (
                    <tr key={row.id} className="border-b border-white/3 bg-white/2">
                      <td className="pl-12 pr-5 py-2 text-neutral-400 text-xs">{row.expense_date} — {row.title}</td>
                      <td className="px-5 py-2 text-right text-xs text-neutral-400">
                        {row.status !== 'paid' ? (
                          <span>{fmt(row.currency === 'VND' ? row.amount : row.amount * rate)}
                            {row.currency !== 'VND' && <span className="text-neutral-600 ml-1">(${fmt(row.amount)})</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-2 text-right text-xs text-emerald-400/70">
                        {row.status === 'paid' ? (
                          <span>{fmt(row.currency === 'VND' ? row.amount : row.amount * rate)}
                            {row.currency !== 'VND' && <span className="text-neutral-600 ml-1">(${fmt(row.amount)})</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-2 text-right text-xs">{statusBadge(row.status)}</td>
                      <td className="px-5 py-2 text-center text-xs text-neutral-600">{row.currency !== 'VND' && row.currency}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
