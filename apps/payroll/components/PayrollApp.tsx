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
    updateRecord, saveRecord, updateStandardWorkDays, recalcAllRecords, confirmSheet, markSheetPaid, rollbackSheet, resolveDispute, refreshRecords, backToSheets,
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
          onUpdateStandardWorkDays={updateStandardWorkDays}
          onRecalcAll={recalcAllRecords}
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
  const STATUS_META: Record<string, { label: string; color: string }> = {
    draft: { label: 'Nháp', color: '#FFA726' },
    confirmed: { label: 'Đã xác nhận', color: '#34C759' },
    paid: { label: 'Đã trả', color: '#0A84FF' },
  };
  const countBy = (st: string) => sheets.filter(s => s.status === st).length;
  const kpis = [
    { label: 'Tổng bảng lương', value: sheets.length, color: '#FFFFFF' },
    { label: 'Nháp', value: countBy('draft'), color: STATUS_META.draft.color },
    { label: 'Đã xác nhận', value: countBy('confirmed'), color: STATUS_META.confirmed.color },
    { label: 'Đã trả', value: countBy('paid'), color: STATUS_META.paid.color },
  ];
  const years = Array.from(new Set(sheets.map(s => s.year))).sort((a, b) => b - a);
  const inputCls = 'px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors';

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {toast && <ToastNotification message={{ text: toast.message, type: toast.type }} onDismiss={() => setToast(null)} />}
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

      {listTab === 'calculator' ? (
        <GrossNetCalculator />
      ) : listTab === 'formula' ? (
        <PayrollFormulaPanel
          currentUser={currentUser}
          onNotify={(message, type) => setToast({ message, type })}
        />
      ) : (
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full animate-fadeInUp space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
              Bảng lương
            </h2>
            <p className="text-sm text-neutral-medium mt-1">Tạo, duyệt và chi trả bảng lương hàng tháng</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className={showCreate
              ? 'px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all'
              : 'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:opacity-90'}
            style={showCreate ? undefined : { background: '#FF9500' }}>
            {showCreate ? 'Đóng' : '+ Tạo bảng lương'}
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-[20px] border p-5 animate-fadeInUp"
            style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}>
            <p className="text-base font-black uppercase tracking-wider text-white mb-4">Bảng lương mới</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Tháng</label>
                <select className={inputCls} style={{ background: '#1a1a1a' }}
                  value={newMonth} onChange={e => setNewMonth(+e.target.value)}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">Năm</label>
                <input type="number" className={`${inputCls} w-28`} style={{ background: '#1a1a1a' }}
                  value={newYear} onChange={e => setNewYear(+e.target.value)} />
              </div>
              <button onClick={() => { createSheet(newMonth, newYear); setShowCreate(false); }}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
                style={{ background: '#FF9500' }}>
                {loading ? 'Đang tạo...' : 'Tạo & tính lương'}
              </button>
              <p className="text-xs text-neutral-medium basis-full">
                Hệ thống lấy dữ liệu chấm công + lương nhân viên để tính tự động. Có thể chỉnh từng dòng sau khi tạo.
              </p>
            </div>
          </div>
        )}

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-[20px] border border-primary/10 p-5 space-y-1 bg-surface">
              <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">{k.label}</p>
              <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Sheets list */}
        {loading && sheets.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="rounded-[20px] border border-primary/10 bg-surface text-center py-16">
            <p className="text-sm font-semibold text-white">Chưa có bảng lương nào</p>
            <p className="text-xs text-neutral-medium mt-1">Bấm "+ Tạo bảng lương" để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-6">
            {years.map(year => (
              <section key={year} className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Năm {year}</p>
                {sheets.filter(s => s.year === year).map(sheet => {
                  const meta = STATUS_META[sheet.status] ?? STATUS_META.draft;
                  return (
                    <div key={sheet.id}
                      className="flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface cursor-pointer group"
                      onClick={() => openSheet(sheet)}>
                      <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                        style={{ background: 'rgba(255,149,0,0.08)' }}>
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 leading-none">Th</span>
                        <span className="text-lg font-black text-primary leading-tight">{String(sheet.month).padStart(2, '0')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{sheet.title}</p>
                        <p className="text-xs text-neutral-medium mt-0.5">Kỳ lương {sheet.month}/{sheet.year}</p>
                      </div>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg"
                        style={{ background: `${meta.color}20`, color: meta.color }}>
                        {meta.label}
                      </span>
                      {sheet.status === 'draft' && (
                        confirmDeleteId === sheet.id ? (
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { deleteSheet(sheet.id); setConfirmDeleteId(null); }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all">Xoá</button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all">Huỷ</button>
                          </div>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(sheet.id); }}
                            aria-label="Xoá bảng lương"
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-red-400 hover:border-red-500/30 transition-all md:opacity-0 md:group-hover:opacity-100">
                            Xoá
                          </button>
                        )
                      )}
                      <span className="text-neutral-medium group-hover:text-primary transition-colors">→</span>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </main>
      )}
      <footer className="py-12 border-t border-white/5 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>
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
