import React from 'react';
import { InvoiceData } from '@/types';
import { Button } from '@/components/Button';
import { FilterBar } from './FilterBar';

interface HistoryTabProps {
  theme: string;
  history: InvoiceData[];
  filteredHistory: InvoiceData[];
  isLoading: boolean;
  filterStudio: string; setFilterStudio: (v: string) => void;
  filterClient: string; setFilterClient: (v: string) => void;
  filterDateFrom: string; setFilterDateFrom: (v: string) => void;
  filterDateTo: string; setFilterDateTo: (v: string) => void;
  resetConfirmId: string | null;
  formatCurrencySimple: (val: number, curr: string) => string;
  onRefresh: () => void;
  onLoadFromHistory: (inv: InvoiceData) => void;
  onDuplicateInvoice: (inv: InvoiceData) => void;
  onCreateEInvoice: (inv: InvoiceData) => void;
  onDownloadEInvoice: (inv: InvoiceData) => void;
  onToggleStatus: (id: string, status: InvoiceData['status']) => void;
  onDeleteInvoice: (id: string) => void;
  onResetEInvoice: (id: string) => void;
  onConfirmResetEInvoice: () => void;
  onCancelResetEInvoice: () => void;
  onSendEmail: (inv: InvoiceData) => void;
  onSyncEInvoices: () => void;
  isSyncingEInvoices: boolean;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  theme, history, filteredHistory, isLoading,
  filterStudio, setFilterStudio, filterClient, setFilterClient,
  filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
  resetConfirmId,
  formatCurrencySimple, onRefresh, onLoadFromHistory, onDuplicateInvoice,
  onCreateEInvoice, onDownloadEInvoice, onToggleStatus, onDeleteInvoice,
  onResetEInvoice, onConfirmResetEInvoice, onCancelResetEInvoice, onSendEmail,
  onSyncEInvoices, isSyncingEInvoices,
}) => (
  <div className="animate-fadeInUp space-y-8">
    <div className="flex justify-between items-end">
      <div>
        <h2 className="text-2xl md:text-4xl font-black text-primary uppercase tracking-tighter">Invoice History</h2>
        <p className={`${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'} text-sm mt-2`}>Synced from Supabase</p>
      </div>
      <Button onClick={onSyncEInvoices} variant="ghost" size="sm" disabled={isLoading || isSyncingEInvoices}>
        {isSyncingEInvoices ? '⏳ Syncing...' : isLoading ? 'Loading...' : '🔄 Refresh'}
      </Button>
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

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredHistory.length === 0 && !isLoading && (
        <div className="col-span-full py-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="opacity-50 font-black uppercase tracking-widest text-xs">No invoices found</p>
        </div>
      )}
      {filteredHistory.map((inv) => {
        const sub = inv.items.reduce((a, b) => a + (b.quantity * b.unitPrice), 0);
        const disc = inv.discountType === 'percentage' ? sub * (inv.discountValue / 100) : (inv.discountValue || 0);
        const invoiceTotal = Math.max(0, sub - disc) * (1 + (inv.taxRate || 0) / 100);
        const hasFee = inv.status === 'paid' && inv.transfer_fee !== undefined && inv.transfer_fee > 0;

        return (
        <div key={inv.id} className={`rounded-[20px] border transition-all hover:scale-[1.01] ${theme === 'dark' ? 'bg-surface border-primary/10 hover:border-primary/25' : 'bg-white border-gray-200 shadow-md hover:shadow-lg'} relative overflow-hidden group`}>
          {/* Status accent bar */}
          <div className={`h-1 w-full ${inv.status === 'paid' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`} />

          <div className="p-5">
            {/* Row 1: Invoice number + Date */}
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{inv.invoiceNumber}</h3>
              <span className={`text-[10px] font-bold tabular-nums ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>{inv.issueDate}</span>
            </div>

            {/* Row 2: Client + Studio */}
            <p className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>{inv.clientInfo?.name || 'Untitled Client'}</p>
            {inv.studioInfo?.name && <p className={`text-[10px] truncate mt-0.5 ${theme === 'dark' ? 'text-neutral-medium/50' : 'text-gray-400'}`}>{inv.studioInfo.name}</p>}

            {/* Row 3: Badges row */}
            <div className="flex items-center gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${inv.status === 'paid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                {inv.status}
              </span>
              {inv.paidDate && <span className="text-[9px] text-emerald-400/60 font-bold tabular-nums">{inv.paidDate}</span>}
              {inv.einvoice_status === 'draft' && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onResetEInvoice(inv.id!); }} title="Reset eInvoice"
                  className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/15 text-amber-400 hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer">
                  Nháp ✎
                </button>
              )}
              {inv.einvoice_status === 'issued' && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-400">
                  Đã Ký{inv.einvoice_invoice_number ? ` #${inv.einvoice_invoice_number}` : ''}
                </span>
              )}
              {inv.einvoice_status === 'failed' && <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-500/15 text-red-400">eInvoice ✗</span>}
            </div>

            {/* Row 4: Amount + Payment details */}
            <div className="mt-4 pt-3 border-t border-primary/5">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xl font-black text-primary tabular-nums">{formatCurrencySimple(invoiceTotal, inv.currency)}</p>
                  {hasFee && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-bold text-emerald-400 tabular-nums">↳ Nhận {formatCurrencySimple(inv.amount_received!, inv.currency)}</span>
                      <span className="text-xs font-bold text-orange-500 tabular-nums">phí -{formatCurrencySimple(inv.transfer_fee!, inv.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action bar — visible on hover */}
            <div className={`flex items-center justify-end gap-1.5 mt-3 pt-3 border-t border-primary/5 opacity-40 group-hover:opacity-100 transition-opacity`}>
              <button onClick={() => onLoadFromHistory(inv)} title="Edit" className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'} hover:text-primary`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={() => onDuplicateInvoice(inv)} title="Clone" className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'} hover:text-blue-400`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {(!inv.einvoice_status || inv.einvoice_status === 'none' || inv.einvoice_status === 'failed') ? (
                <button onClick={() => onCreateEInvoice(inv)} title="Xuất eInvoice" className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'} hover:text-emerald-400`}>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : (inv.einvoice_status === 'draft' || inv.einvoice_status === 'issued') ? (
                <button onClick={() => onDownloadEInvoice(inv)} title="Tải PDF" className={`p-2 rounded-lg transition-colors text-emerald-400 ${theme === 'dark' ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50'}`}>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : null}
              <button onClick={() => onToggleStatus(inv.id!, inv.status)} title={inv.status === 'paid' ? 'Revert to Pending' : 'Mark Paid'} className={`p-2 rounded-lg transition-colors ${inv.status === 'paid' ? 'text-emerald-400' : ''} ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'} hover:text-primary`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={() => onSendEmail(inv)} title="Email" className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'} hover:text-blue-400`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className={`w-px h-5 mx-0.5 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
              <button onClick={() => onDeleteInvoice(inv.id!)} title="Xoá" className={`p-2 rounded-lg transition-colors text-red-500/50 hover:text-red-400 ${theme === 'dark' ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </div>
        );
      })}
    </div>

    {/* Reset eInvoice Confirmation Popup */}
    {resetConfirmId && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className={`w-full max-w-sm p-8 rounded-[28px] border shadow-2xl animate-fadeInUp ${theme === 'dark' ? 'bg-[#1A1A1A] border-red-500/20' : 'bg-white border-gray-200'}`}>
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className={`text-lg font-black uppercase tracking-tighter text-center mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Reset eInvoice?</h3>
          <p className={`text-sm text-center mb-8 ${theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
            Xoá trạng thái eInvoice để xuất lại hoá đơn điện tử mới. Chỉ làm điều này nếu đã xoá hoá đơn nháp trên SePay Portal.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={onCancelResetEInvoice}
              className={`py-4 rounded-2xl text-sm font-black uppercase tracking-widest border transition-all hover:scale-[1.02] ${theme === 'dark' ? 'border-white/10 text-white/60 hover:text-white hover:border-white/30' : 'border-gray-200 text-gray-500 hover:text-black hover:border-gray-400'}`}>
              Huỷ
            </button>
            <button onClick={onConfirmResetEInvoice}
              className="py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-red-500 text-white transition-all hover:scale-[1.02] hover:bg-red-600 shadow-lg">
              Xoá eInvoice
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
