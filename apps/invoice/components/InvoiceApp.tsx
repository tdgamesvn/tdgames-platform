import React from 'react';
import AppBackground from '@/components/AppBackground';
import { useInvoiceState } from '../hooks/useInvoiceState';
import { avgRate } from '../services/exchangeRateService';
import { AccountUser } from '@/types';

// Invoice‑specific components
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from './Navbar';
import { HistoryTab } from './HistoryTab';
import { DashboardTab } from './DashboardTab';
import { InvoiceEditor } from './InvoiceEditor';
import { EInvoiceModals } from './EInvoiceModals';
import { ActivityLogTab } from './ActivityLogTab';
import { RecurringTab } from './RecurringTab';
import { EmailModal } from './EmailModal';
import ARAgingTab from './ARAgingTab';

interface InvoiceAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const InvoiceApp: React.FC<InvoiceAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = useInvoiceState(initialTab);

  // Sync the currentUser from parent
  React.useEffect(() => {
    if (currentUser && !state.currentUser) {
      state.setCurrentUser(currentUser);
    }
  }, [currentUser]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500" style={{ backgroundColor: state.invoice.theme === 'dark' ? '#0F0F0F' : '#F5F5F5' }}>
      {state.invoice.theme === 'dark' && <AppBackground />}
      <ToastNotification message={state.lastMessage} onDismiss={() => state.setLastMessage(null)} />

      <Navbar
        theme={state.invoice.theme}
        currentUser={state.currentUser || currentUser}
        activeTab={state.activeTab}
        accessibleTabs={state.accessibleTabs}
        onTabChange={state.setActiveTab}
        onLogout={onBack}
        vcbRate={state.vcbRate}
        vcbRateLoading={state.vcbRateLoading}
        onBack={onBack}
        appName="Invoice"
        tabLabels={{ aging: 'AR Aging' }}
      />

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {state.activeTab === 'history' ? (
          <HistoryTab
            theme={state.invoice.theme} history={state.history} filteredHistory={state.filteredHistory} isLoading={state.isLoading}
            filterStudio={state.filterStudio} setFilterStudio={state.setFilterStudio}
            filterClient={state.filterClient} setFilterClient={state.setFilterClient}
            filterDateFrom={state.filterDateFrom} setFilterDateFrom={state.setFilterDateFrom}
            filterDateTo={state.filterDateTo} setFilterDateTo={state.setFilterDateTo}
            resetConfirmId={state.resetConfirmId}
            formatCurrencySimple={state.formatCurrencySimple}
            onRefresh={state.loadHistory} onLoadFromHistory={state.loadFromHistory}
            onDuplicateInvoice={state.handleDuplicateInvoice}
            onCreateEInvoice={state.handleCreateEInvoice} onDownloadEInvoice={state.handleDownloadEInvoice}
            onToggleStatus={state.toggleStatus} onDeleteInvoice={state.handleDeleteInvoice}
            onResetEInvoice={state.handleResetEInvoice} onConfirmResetEInvoice={state.confirmResetEInvoice}
            onCancelResetEInvoice={() => state.setResetConfirmId(null)}
            onSendEmail={(inv) => state.setEmailInvoice(inv)}
            onSyncEInvoices={state.syncEInvoiceStatuses} isSyncingEInvoices={state.isSyncingEInvoices}
          />
        ) : state.activeTab === 'dashboard' ? (
          <DashboardTab
            theme={state.invoice.theme} history={state.history} filteredHistory={state.filteredHistory} isLoading={state.isLoading}
            filterStudio={state.filterStudio} setFilterStudio={state.setFilterStudio}
            filterClient={state.filterClient} setFilterClient={state.setFilterClient}
            filterDateFrom={state.filterDateFrom} setFilterDateFrom={state.setFilterDateFrom}
            filterDateTo={state.filterDateTo} setFilterDateTo={state.setFilterDateTo}
            formatCurrencySimple={state.formatCurrencySimple}
            onRefresh={state.loadHistory} onToggleStatus={state.toggleStatus}
          />
        ) : state.activeTab === 'aging' ? (
          <ARAgingTab theme={state.invoice.theme} history={state.history} />
        ) : state.activeTab === 'activity' ? (
          <ActivityLogTab theme={state.invoice.theme} />
        ) : state.activeTab === 'recurring' ? (
          <RecurringTab
            theme={state.invoice.theme}
            clients={state.clients}
            studios={state.studios}
            banks={state.banks}
            formatCurrencySimple={state.formatCurrencySimple}
          />
        ) : (
          <InvoiceEditor
            invoice={state.invoice} activeTab={state.activeTab}
            studios={state.studios} banks={state.banks} clients={state.clients}
            isLoading={state.isLoading} isExporting={state.isExporting}
            showBankManager={state.showBankManager} showStudioManager={state.showStudioManager}
            editingBankId={state.editingBankId} editingBankData={state.editingBankData}
            editingStudioId={state.editingStudioId} editingStudioData={state.editingStudioData}
            newStudio={state.newStudio} newBank={state.newBank}
            clientSuggestions={state.clientSuggestions} showSuggestions={state.showSuggestions}
            eInvoiceProgress={state.eInvoiceProgress}
            updateInvoice={state.updateInvoice} updateItem={state.updateItem} formatCurrencySimple={state.formatCurrencySimple}
            onExport={state.handleExport} onSaveToCloud={state.handleSaveToCloud}
            onCreateEInvoice={() => state.handleCreateEInvoice()} onBankSelect={state.handleBankSelect}
            onSaveClient={state.handleSaveClient} onSelectClient={state.handleSelectClient}
            setShowSuggestions={state.setShowSuggestions} setClientSuggestions={state.setClientSuggestions}
            setShowBankManager={state.setShowBankManager} setNewBank={state.setNewBank}
            onAddBank={state.handleAddBank} onDeleteBank={state.handleDeleteBank}
            onSetDefaultBank={state.handleSetDefaultBank} onEditBank={state.handleEditBank}
            onCancelEditBank={state.handleCancelEdit} onUpdateBank={state.handleUpdateBank}
            setEditingBankData={state.setEditingBankData}
            setShowStudioManager={state.setShowStudioManager} setNewStudio={state.setNewStudio}
            onAddStudio={state.handleAddStudio} onDeleteStudio={state.handleDeleteStudio}
            onSetDefaultStudio={state.handleSetDefaultStudio} onEditStudio={state.handleEditStudio}
            onUpdateStudio={state.handleUpdateStudio}
            setEditingStudioId={state.setEditingStudioId} setEditingStudioData={state.setEditingStudioData}
          />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>

      <EInvoiceModals
        theme={state.invoice.theme} invoice={state.invoice}
        showSaveConfirm={state.showSaveConfirm} pendingInvoiceToSave={state.pendingInvoiceToSave}
        onConfirmSave={state.handleConfirmSave} onDismissSave={state.handleDismissSave}
        showEInvoicePrompt={state.showEInvoicePrompt} eInvoiceTargetInvoice={state.eInvoiceTargetInvoice}
        onCreateEInvoice={state.handleCreateEInvoice}
        onDismissEInvoicePrompt={() => { state.setShowEInvoicePrompt(false); state.setEInvoiceTargetInvoice(null); }}
        showEInvoiceModal={state.showEInvoiceModal}
        eInvoiceProgress={state.eInvoiceProgress} eInvoiceResult={state.eInvoiceResult}
        eInvoiceError={state.eInvoiceError} pdfDownloading={state.pdfDownloading}
        onCloseEInvoiceModal={() => { state.setShowEInvoiceModal(false); state.setEInvoiceResult(null); state.setEInvoiceError(null); }}
      />

      {state.emailInvoice && (
        <EmailModal
          theme={state.invoice.theme}
          invoice={state.emailInvoice}
          onClose={() => state.setEmailInvoice(null)}
          onSent={(to) => {
            state.notify(`Email gửi đến ${to} thành công!`, 'success');
            state.loadHistory();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {state.deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={() => state.setDeleteConfirm(null)}>
          <div className={`w-[420px] p-8 rounded-[24px] border ${state.invoice.theme === 'dark' ? 'bg-surface border-red-500/20' : 'bg-white border-red-200 shadow-2xl'}`} onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className={`text-xl font-black mb-2 ${state.invoice.theme === 'dark' ? 'text-white' : 'text-black'}`}>Xác nhận xoá hoá đơn</h3>
              <p className={`text-sm ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                Bạn có chắc chắn muốn xoá hoá đơn này không? Thao tác này không thể hoàn tác.
              </p>
            </div>
            {state.deleteConfirm.hasDraft && (
              <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-400 text-sm font-bold mb-1">⚠️ Cảnh báo eInvoice</p>
                <p className={`text-xs ${state.invoice.theme === 'dark' ? 'text-amber-300/70' : 'text-amber-700'}`}>
                  Hoá đơn này đã có eInvoice nháp trên SePay. Bạn cần vào SePay để huỷ hoá đơn nháp thủ công.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => state.setDeleteConfirm(null)} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors ${state.invoice.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}>
                Huỷ
              </button>
              <button onClick={state.confirmDeleteInvoice} className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white transition-colors">
                Xoá hoá đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {state.paymentModal && (() => {
        const pm = state.paymentModal;
        const currSymbol = pm.currency === 'VND' ? '₫' : '$';
        const formatAmt = (n: number) => pm.currency === 'VND'
          ? n.toLocaleString('vi-VN')
          : n.toLocaleString('en-US', { minimumFractionDigits: 2 });
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div className={`w-[460px] p-8 rounded-[24px] border ${state.invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-200 shadow-2xl'}`}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">💰</span>
                </div>
                <h3 className={`text-xl font-black mb-2 ${state.invoice.theme === 'dark' ? 'text-white' : 'text-black'}`}>Xác nhận thanh toán</h3>
                <p className={`text-sm ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                  Nhập số tiền thực nhận sau phí chuyển khoản
                </p>
              </div>
              <div className={`mb-5 p-4 rounded-xl ${state.invoice.theme === 'dark' ? 'bg-black/30 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Tổng hoá đơn</p>
                <p className="text-xl font-black text-primary tabular-nums">{currSymbol}{formatAmt(pm.invoiceTotal)}</p>
              </div>
              <div className="mb-4">
                <label className={`text-[11px] font-black uppercase tracking-widest block mb-2 ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                  Số tiền thực nhận ({currSymbol})
                </label>
                <input
                  type="number" value={pm.amountReceived}
                  onChange={(e) => {
                    const received = Number(e.target.value);
                    state.setPaymentModal({ ...pm, amountReceived: received, transferFee: Math.max(0, pm.invoiceTotal - received) });
                  }}
                  className="w-full text-xl font-black bg-transparent outline-none border-b-2 border-primary pb-2 text-primary tabular-nums"
                  step="0.01"
                />
              </div>
              <div className={`mb-6 p-4 rounded-xl ${pm.transferFee > 0 ? (state.invoice.theme === 'dark' ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-amber-50 border border-amber-200') : (state.invoice.theme === 'dark' ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200')}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] font-black uppercase tracking-widest ${pm.transferFee > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    Phí chuyển khoản
                  </span>
                  <span className={`text-lg font-black tabular-nums ${pm.transferFee > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {pm.transferFee > 0 ? `-${currSymbol}${formatAmt(pm.transferFee)}` : `${currSymbol}0`}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => state.setPaymentModal(null)} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors ${state.invoice.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}>
                  Huỷ
                </button>
                <button onClick={state.confirmPayment} className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                  ✓ Xác nhận Paid
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Exchange Rate Modal (USD → VND for eInvoice) */}
      {state.showExchangeRateModal && state.exchangeRateTarget && (() => {
        const inv = state.exchangeRateTarget;
        const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
        const subtotal = items.reduce((a: number, i: any) => a + i.quantity * i.unitPrice, 0);
        const disc = inv.discountType === 'percentage' ? subtotal * (inv.discountValue / 100) : inv.discountValue;
        const afterDisc = Math.max(0, subtotal - disc);
        const tax = afterDisc * (inv.taxRate / 100);
        const totalUSD = afterDisc + tax;
        const totalVND = Math.round(totalUSD * state.exchangeRate);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={() => state.setShowExchangeRateModal(false)}>
            <div className={`w-[480px] p-8 rounded-[24px] border ${state.invoice.theme === 'dark' ? 'bg-surface border-primary/20' : 'bg-white border-gray-200 shadow-2xl'}`} onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">💱</span>
                </div>
                <h3 className={`text-xl font-black mb-2 ${state.invoice.theme === 'dark' ? 'text-white' : 'text-black'}`}>Convert USD → VND</h3>
                <p className={`text-sm ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-500'}`}>
                  SePay only supports VND. Enter exchange rate to convert invoice.
                </p>
              </div>
              <div className={`mb-5 p-4 rounded-xl ${state.invoice.theme === 'dark' ? 'bg-black/30 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>Original Invoice (USD)</p>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-bold ${state.invoice.theme === 'dark' ? 'text-white' : 'text-black'}`}>{inv.invoiceNumber}</span>
                  <span className="text-lg font-black text-primary tabular-nums">${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="mb-5">
                <label className={`text-[11px] font-black uppercase tracking-widest block mb-2 ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                  Exchange Rate (1 USD = ? VND)
                </label>
                <input
                  type="number" value={state.exchangeRate}
                  onChange={(e) => state.setExchangeRate(Number(e.target.value))}
                  className="w-full text-2xl font-black bg-transparent outline-none border-b-2 border-primary pb-2 text-primary tabular-nums"
                  placeholder="25400" min="1"
                />
                <p className={`text-[11px] mt-1 ${state.invoice.theme === 'dark' ? 'text-neutral-medium' : 'text-gray-400'}`}>
                  {state.vcbRate ? (() => {
                    const avg = avgRate(state.vcbRate!);
                    return (
                      <button type="button" onClick={() => state.setExchangeRate(avg)}
                        className="underline decoration-dotted hover:text-primary transition-colors cursor-pointer">
                        🏦 VCB TB: {avg.toLocaleString('vi-VN')} VND (Mua {state.vcbRate!.buy.toLocaleString('vi-VN')} + Bán {state.vcbRate!.sell.toLocaleString('vi-VN')} / 2)
                      </button>
                    );
                  })() : 'Dùng tỉ giá trung bình (mua + bán) / 2 của ngân hàng'}
                </p>
              </div>
              <div className={`mb-6 p-4 rounded-xl ${state.invoice.theme === 'dark' ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-emerald-500">Converted Value (VND)</p>
                <p className="text-2xl font-black text-emerald-400 tabular-nums">
                  {totalVND.toLocaleString('vi-VN')} ₫
                </p>
                <p className={`text-[11px] mt-1 ${state.invoice.theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>
                  = ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} × {state.exchangeRate.toLocaleString('vi-VN')}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => state.setShowExchangeRateModal(false)} className={`flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors ${state.invoice.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}>
                  Cancel
                </button>
                <button onClick={state.confirmCreateEInvoiceWithRate} className="flex-1 py-3 rounded-xl font-black text-sm uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                  Create eInvoice (VND)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default InvoiceApp;
