import React, { useEffect, useState } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { usePayrollState } from '../hooks/usePayrollState';
import { FALLBACK_PAYROLL_FORMULA } from '../services/payrollFormulaService';
import PayrollSheet from './PayrollSheet';
import PayrollFormulaPanel from './PayrollFormulaPanel';
import GrossNetCalculator from './GrossNetCalculator';
import HelpPanel from '@/components/HelpPanel';
import { PAYROLL_HELP } from '../helpContent';

interface PayrollAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const PayrollApp: React.FC<PayrollAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = usePayrollState(initialTab);
  const {
    view, sheets, records, activeSheet, activeFormula, loading, toast,
    setToast, createSheet, openSheet, deleteSheet,
    updateRecord, saveRecord, confirmSheet, markSheetPaid, rollbackSheet, resolveDispute, refreshRecords, backToSheets,
  } = state;

  const [helpOpen, setHelpOpen] = useState(false);
  const [listTab, setListTab] = useState<'history' | 'formula' | 'calculator'>(() =>
    initialTab === 'formula' ? 'formula' : initialTab === 'calculator' ? 'calculator' : 'history',
  );
  useEffect(() => {
    if (initialTab === 'formula') setListTab('formula');
    if (initialTab === 'calculator') setListTab('calculator');
  }, [initialTab]);

  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Detail View ──
  if (view === 'detail' && activeSheet) {
    return (
      <>
        {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
        <PayrollSheet
          sheet={activeSheet}
          records={records}
          formula={activeFormula ?? FALLBACK_PAYROLL_FORMULA}
          loading={loading}
          onBack={backToSheets}
          onUpdateRecord={updateRecord}
          onSaveRecord={saveRecord}
          onConfirm={confirmSheet}
          onMarkPaid={markSheetPaid}
          onRollback={rollbackSheet}
          onResolveDispute={resolveDispute}
          onRefresh={refreshRecords}
        />
      </>
    );
  }

  // ── Sheets List View ──
  return (
    <div className="min-h-screen bg-bg-dark relative overflow-hidden">
      <AppBackground />
      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={listTab}
        accessibleTabs={['history', 'formula', 'calculator']}
        onTabChange={t => setListTab(t as 'history' | 'formula' | 'calculator')}
        onLogout={onBack}
        onBack={onBack}
        appName="Payroll"
        tabLabels={{ history: 'Bảng lương', formula: 'Công thức', calculator: 'Gross-Net' }}
        onHelp={() => setHelpOpen(true)}
      />
      {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}

      {listTab === 'calculator' ? (
        <GrossNetCalculator />
      ) : listTab === 'formula' ? (
        <PayrollFormulaPanel
          currentUser={currentUser}
          onNotify={(message, type) => setToast({ message, type })}
        />
      ) : (
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">💰 Bảng lương</h1>
            <p className="text-neutral-medium text-sm mt-1">Tạo và quản lý bảng lương hàng tháng</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #5E5CE6, #0A84FF)' }}>
            {showCreate ? '✕ Đóng' : '+ Tạo bảng lương'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="p-5 rounded-2xl bg-card-dark border border-primary/10 mb-6">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Tháng</label>
                <select className="px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm outline-none"
                  value={newMonth} onChange={e => setNewMonth(+e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-medium mb-1">Năm</label>
                <input type="number" className="w-24 px-3 py-2 rounded-lg bg-black/30 border border-primary/10 text-white text-sm outline-none"
                  value={newYear} onChange={e => setNewYear(+e.target.value)} />
              </div>
              <div className="pt-5">
                <button onClick={() => { createSheet(newMonth, newYear); setShowCreate(false); }}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all disabled:opacity-30">
                  {loading ? '⏳ Đang tạo...' : '🚀 Tạo & tính lương'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sheets list */}
        {loading && sheets.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-16 opacity-40">
            <div className="text-5xl mb-3">💰</div>
            <p className="text-lg">Chưa có bảng lương nào</p>
            <p className="text-sm">Bấm "+ Tạo bảng lương" để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sheets.map(sheet => (
              <div key={sheet.id}
                className="p-4 rounded-2xl bg-card-dark border border-primary/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors group"
                onClick={() => openSheet(sheet)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center text-xl">
                    📋
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{sheet.title}</p>
                    <p className="text-neutral-medium text-xs mt-0.5">
                      Tháng {sheet.month}/{sheet.year}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg ${
                    sheet.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                    sheet.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {sheet.status === 'draft' ? 'Nháp' : sheet.status === 'confirmed' ? 'Đã xác nhận' : 'Đã trả'}
                  </span>
                  {sheet.status === 'draft' && (
                    confirmDeleteId === sheet.id ? (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { deleteSheet(sheet.id); setConfirmDeleteId(null); }}
                          className="px-3 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">Xác nhận</button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1 rounded-lg bg-white/10 text-neutral-medium text-[10px] font-bold">Hủy</button>
                      </div>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(sheet.id); }}
                        className="text-red-400 hover:text-red-300 text-[10px] font-bold px-2 py-1 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                        🗑️
                      </button>
                    )
                  )}
                  <span className="text-neutral-medium text-sm group-hover:text-white transition-colors">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      )}
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="Payroll"
        appIcon="💰"
        contents={PAYROLL_HELP}
        activeTabId={listTab}
      />
    </div>
  );
};

export default PayrollApp;
