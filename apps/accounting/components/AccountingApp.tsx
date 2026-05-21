import React, { useState } from 'react';
import { AccountUser } from '@/types';
import { useAccountingState, AccountingTab } from '../hooks/useAccountingState';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import FixedAssetTab from './FixedAssetTab';
import AdvanceTab from './AdvanceTab';
import PayablesTab from './PayablesTab';
import PnlTab from './PnlTab';
import BankReconcTab from './BankReconcTab';
import VatTab from './VatTab';
import TncnTab from './TncnTab';
import HelpPanel from '@/components/HelpPanel';
import { ACCOUNTING_HELP } from '../helpContent';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TABS: { id: AccountingTab; label: string; icon: string }[] = [
  { id: 'assets',   label: 'Tài sản',   icon: '🏢' },
  { id: 'advances', label: 'Tạm ứng',   icon: '💳' },
  { id: 'payables', label: 'Công nợ',   icon: '📋' },
  { id: 'pnl',      label: 'Lãi / Lỗ', icon: '📈' },
  { id: 'bank',     label: 'Ngân hàng', icon: '🏦' },
  { id: 'vat',      label: 'VAT',       icon: '🧾' },
  { id: 'tncn',     label: 'TNCN',      icon: '💼' },
];

const AccountingApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const state = useAccountingState(currentUser.username, initialTab);
  const { avgUsdVnd } = useExchangeRate();
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const wrapAction = async (fn: () => Promise<void>, successMsg: string) => {
    try {
      await fn();
      showToast(successMsg);
    } catch (e: any) {
      showToast(e.message || 'Có lỗi xảy ra', 'error');
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/5" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="flex items-center gap-4 px-6 h-14 overflow-x-auto">
          <button onClick={onBack}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🧾</span>
            <span className="text-white font-black uppercase tracking-widest text-sm">Kế toán</span>
          </div>
          {/* Tab bar — scrollable */}
          <div className="flex gap-1 ml-2 flex-nowrap overflow-x-auto flex-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => state.setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  state.activeTab === t.id
                    ? 'text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
                style={state.activeTab === t.id ? { background: '#FF9500' } : {}}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Help button */}
          <button
            onClick={() => setHelpOpen(true)}
            title="Hướng dẫn sử dụng"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider text-neutral-400 hover:text-white hover:bg-white/5 transition-all border border-white/10 hover:border-white/20">
            <span>?</span>
            <span className="hidden sm:inline">Trợ giúp</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {state.loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : state.error ? (
          <div className="text-center py-20 text-red-400 text-sm">{state.error}</div>
        ) : (
          <>
            {state.activeTab === 'assets' && (
              <FixedAssetTab
                assets={state.assets}
                onAdd={state.addAsset}
                onEdit={state.editAsset}
                onDelete={state.removeAsset}
                onToast={showToast}
              />
            )}
            {state.activeTab === 'advances' && (
              <AdvanceTab
                advances={state.advances}
                openTotal={state.openAdvancesTotal}
                onAdd={state.addAdvance}
                onSettle={state.settle}
                onCancel={state.cancel}
                onDelete={state.removeAdvance}
                onToast={showToast}
              />
            )}
            {state.activeTab === 'payables' && (
              <PayablesTab expenses={state.expenses} />
            )}
            {state.activeTab === 'pnl' && (
              <PnlTab
                expenses={state.expenses}
                invoices={state.invoices}
                vcbAvgRate={avgUsdVnd}
              />
            )}
            {state.activeTab === 'bank' && (
              <BankReconcTab
                statements={state.statements}
                invoices={state.invoices}
                expenses={state.expenses}
                advances={state.advances}
                vcbAvgRate={avgUsdVnd}
                onImport={async (bank, rows) => {
                  await wrapAction(
                    () => state.importStatements(bank, rows),
                    `Import ${rows.length} giao dịch thành công`
                  );
                }}
                onMatch={async (id, type, matchedId) => {
                  await wrapAction(
                    () => state.matchStatement(id, type, matchedId),
                    'Đã khớp giao dịch'
                  );
                }}
                onUnmatch={async (id) => {
                  await wrapAction(
                    () => state.unmatchStatement(id),
                    'Đã bỏ khớp'
                  );
                }}
              />
            )}
            {state.activeTab === 'vat' && (
              <VatTab
                invoices={state.invoices}
                vcbAvgRate={avgUsdVnd}
              />
            )}
            {state.activeTab === 'tncn' && (
              <TncnTab
                records={state.payrollRecords}
                employees={state.employees}
              />
            )}
          </>
        )}
      </div>

      {/* Help Panel */}
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="Kế toán"
        appIcon="🧾"
        contents={ACCOUNTING_HELP}
        activeTabId={state.activeTab}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl transition-all ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
        }`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AccountingApp;
