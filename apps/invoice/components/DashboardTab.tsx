import React from 'react';
import { InvoiceData } from '@/types';
import { Button } from '@/components/Button';
import { FilterBar } from './FilterBar';

interface DashboardTabProps {
  theme: string;
  history: InvoiceData[];
  filteredHistory: InvoiceData[];
  isLoading: boolean;
  filterStudio: string; setFilterStudio: (v: string) => void;
  filterClient: string; setFilterClient: (v: string) => void;
  filterDateFrom: string; setFilterDateFrom: (v: string) => void;
  filterDateTo: string; setFilterDateTo: (v: string) => void;
  formatCurrencySimple: (val: number, curr: string) => string;
  onRefresh: () => void;
  onToggleStatus: (id: string, status: InvoiceData['status']) => void;
}

const calcTotal = (inv: InvoiceData) => {
  const sub = inv.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const disc = inv.discountType === 'percentage' ? sub * (inv.discountValue / 100) : inv.discountValue;
  return Math.max(0, sub - disc) * (1 + inv.taxRate / 100);
};

/** Group paid revenue by currency → { USD: { clientName: amount }, VND: { ... } } */
const buildRevenueByCurrency = (invoices: InvoiceData[]) => {
  const map: Record<string, Record<string, number>> = {};
  invoices.filter(i => i.status === 'paid').forEach(inv => {
    const curr = inv.currency || 'USD';
    const name = inv.clientInfo?.name || 'Unknown';
    if (!map[curr]) map[curr] = {};
    // Use amount_received if available (actual money), else fall back to invoice total
    const amount = inv.amount_received ?? calcTotal(inv);
    map[curr][name] = (map[curr][name] || 0) + amount;
  });
  return map;
};

/** Sum transfer fees by currency */
const calcTransferFeesByCurrency = (invoices: InvoiceData[]) => {
  const map: Record<string, number> = {};
  invoices.filter(i => i.status === 'paid' && i.transfer_fee && i.transfer_fee > 0).forEach(inv => {
    const curr = inv.currency || 'USD';
    map[curr] = (map[curr] || 0) + (inv.transfer_fee || 0);
  });
  return map;
};

/** Group unpaid totals by currency */
const calcPendingByCurrency = (invoices: InvoiceData[]) => {
  const map: Record<string, number> = {};
  invoices.filter(i => i.status !== 'paid').forEach(inv => {
    const curr = inv.currency || 'USD';
    map[curr] = (map[curr] || 0) + calcTotal(inv);
  });
  return map;
};

export const DashboardTab: React.FC<DashboardTabProps> = ({
  theme, history, filteredHistory, isLoading,
  filterStudio, setFilterStudio, filterClient, setFilterClient,
  filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  formatCurrencySimple, onRefresh, onToggleStatus,
}) => {
  const pending = filteredHistory.filter(i => i.status !== 'paid');
  const revByCurrency = buildRevenueByCurrency(filteredHistory);
  const pendingByCurrency = calcPendingByCurrency(filteredHistory);
  const transferFeesByCurrency = calcTransferFeesByCurrency(filteredHistory);
  const currencies = Array.from(new Set<string>(filteredHistory.map(i => String(i.currency || 'USD')))).sort();

  return (
    <div className="animate-fadeInUp space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">📊 Dashboard</h2>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>Revenue & receivables overview</p>
        </div>
        <Button onClick={onRefresh} variant="ghost" size="sm" disabled={isLoading}>{isLoading ? 'Loading...' : 'Refresh'}</Button>
      </div>

      <FilterBar
        studios={[...new Set(history.map(i => i.studioInfo?.name).filter(Boolean) as string[])]}
        clients={[...new Set(history.map(i => i.clientInfo?.name).filter(Boolean) as string[])]}
        filterStudio={filterStudio} setFilterStudio={setFilterStudio}
        filterClient={filterClient} setFilterClient={setFilterClient}
        filterDateFrom={filterDateFrom} setFilterDateFrom={setFilterDateFrom}
        filterDateTo={filterDateTo} setFilterDateTo={setFilterDateTo}
        filteredCount={filteredHistory.length} totalCount={history.length}
      />

      {/* KPI Cards — one row per currency + totals */}
      <div className="space-y-4">
        {currencies.map(curr => {
          const revTotal = Object.values(revByCurrency[curr] || {}).reduce((a: number, b: number) => a + b, 0);
          const pendingTotal = pendingByCurrency[curr] || 0;
          const count = filteredHistory.filter(i => (i.currency || 'USD') === curr).length;
          return (
            <div key={curr} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Currency label */}
              <div className={`p-5 rounded-[20px] border flex items-center gap-3 ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
                <span className="text-3xl font-black text-primary">{curr === 'VND' ? '₫' : '$'}</span>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Currency</p>
                  <p className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{curr}</p>
                </div>
              </div>
              {/* Revenue */}
              <div className={`p-5 rounded-[20px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Net Received</p>
                <p className="text-xl font-black text-status-success">{formatCurrencySimple(revTotal, curr)}</p>
              </div>
              {/* Transfer Fees */}
              <div className={`p-5 rounded-[20px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Transfer Fees</p>
                <p className={`text-xl font-black ${(transferFeesByCurrency[curr] || 0) > 0 ? 'text-amber-400' : 'text-neutral-medium/30'}`}>
                  {(transferFeesByCurrency[curr] || 0) > 0 ? `-${formatCurrencySimple(transferFeesByCurrency[curr], curr)}` : '—'}
                </p>
              </div>
              {/* Pending */}
              <div className={`p-5 rounded-[20px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Unpaid</p>
                <p className="text-xl font-black text-status-warning">{pendingTotal > 0 ? formatCurrencySimple(pendingTotal, curr) : '—'}</p>
              </div>
              {/* Invoice count */}
              <div className={`p-5 rounded-[20px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Invoices</p>
                <p className="text-xl font-black text-primary">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue per client — grouped by currency */}
      {currencies.map(curr => {
        const clientMap = revByCurrency[curr] || {};
        const clientList = Object.entries(clientMap).sort((a, b) => b[1] - a[1]);
        const total = clientList.reduce((a: number, [, v]: [string, number]) => a + v, 0);
        if (clientList.length === 0) return null;
        return (
          <div key={curr} className={`p-8 rounded-[24px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
            <h3 className="text-xl font-black uppercase tracking-tighter text-primary mb-6">
              Revenue by Client <span className="text-sm font-bold text-neutral-medium ml-2">({curr})</span>
            </h3>
            <div className="space-y-4">
              {clientList.map(([name, rev]) => (
                <div key={name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold">{name}</span>
                    <span className="text-sm font-black text-primary">{formatCurrencySimple(rev, curr)}</span>
                  </div>
                  <div className={`h-2 rounded-full ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${total > 0 ? (rev / total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Pending invoices — with currency shown */}
      <div className={`p-8 rounded-[24px] border ${theme === 'dark' ? 'bg-surface border-primary/10' : 'bg-white border-gray-200 shadow-md'}`}>
        <h3 className="text-xl font-black uppercase tracking-tighter text-status-warning mb-6">⚠️ Unpaid ({pending.length})</h3>
        {pending.length === 0 ? <p className="opacity-30 text-xs font-black uppercase">All invoices paid 🎉</p> : (
          <div className="space-y-3">
            {pending.map(inv => (
              <div key={inv.id} className={`flex items-center justify-between p-4 rounded-xl border ${theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-gray-100 bg-gray-50'}`}>
                <div>
                  <p className="text-sm font-black">{inv.invoiceNumber}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>{inv.clientInfo?.name} • Due: {inv.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-primary font-black text-sm">{formatCurrencySimple(calcTotal(inv), inv.currency)}</p>
                  <button onClick={() => onToggleStatus(inv.id!, inv.status)} className="px-3 py-1.5 rounded-lg bg-status-success/20 text-status-success text-[10px] font-black uppercase hover:bg-status-success/30 transition-colors">Mark Paid</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
