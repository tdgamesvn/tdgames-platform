import React, { useState } from 'react';
import { AccountUser } from '@/types';
import { useAccountingState, AccountingTab } from '../hooks/useAccountingState';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import AppBackground from '@/components/AppBackground';
import { Navbar } from '@/components/Navbar';
import { ToastNotification } from '@/components/ToastNotification';
import FixedAssetTab from './FixedAssetTab';
import AdvanceTab from './AdvanceTab';
import PayablesTab from './PayablesTab';
import PnlTab from './PnlTab';
import BankReconcTab from './BankReconcTab';
import VatTab from './VatTab';
import TncnTab from './TncnTab';
import BhxhTab from './BhxhTab';
import HelpPanel from '@/components/HelpPanel';
import { ACCOUNTING_HELP } from '../helpContent';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_LABELS: Record<string, string> = {
  assets:   '🏢 Tài sản',
  advances: '💳 Tạm ứng',
  payables: '📋 Công nợ',
  pnl:      '📈 Lãi / Lỗ',
  bank:     '🏦 Ngân hàng',
  vat:      '🧾 VAT',
  tncn:     '💼 TNCN',
  bhxh:     '🛡️ BHXH',
};

const ACCESSIBLE_TABS = ['assets', 'advances', 'payables', 'pnl', 'bank', 'vat', 'tncn', 'bhxh'] as const;

const AccountingApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const state = useAccountingState(currentUser.username, initialTab);
  const { rate: vcbRate, loading: vcbRateLoading, avgUsdVnd } = useExchangeRate();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ message: msg, type });
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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />

      {toast && (
        <ToastNotification
          message={{ text: toast.message, type: toast.type }}
          onDismiss={() => setToast(null)}
        />
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={state.activeTab}
        accessibleTabs={ACCESSIBLE_TABS as any}
        onTabChange={tab => state.setActiveTab(tab as AccountingTab)}
        onLogout={onBack}
        onBack={onBack}
        vcbRate={vcbRate}
        vcbRateLoading={vcbRateLoading}
        appName="Kế toán"
        tabLabels={TAB_LABELS}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
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
              <PayablesTab expenses={state.expenses} vcbRate={avgUsdVnd} />
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
                freelancerSettlements={state.freelancerSettlements}
                vcbAvgRate={avgUsdVnd}
              />
            )}
            {state.activeTab === 'bhxh' && (
              <BhxhTab employees={state.bhxhEmployees} />
            )}
          </>
        )}
      </main>

      <footer className="py-12 border-t border-white/5 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="Kế toán"
        appIcon="🧾"
        contents={ACCOUNTING_HELP}
        activeTabId={state.activeTab}
      />
    </div>
  );
};

export default AccountingApp;
