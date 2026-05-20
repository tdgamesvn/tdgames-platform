import React, { useState } from 'react';
import { AccountUser } from '@/types';
import { useAccountingState } from '../hooks/useAccountingState';
import FixedAssetTab from './FixedAssetTab';
import AdvanceTab from './AdvanceTab';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TABS = [
  { id: 'assets' as const,   label: '🏢 Tài sản cố định' },
  { id: 'advances' as const, label: '💳 Tạm ứng' },
];

const AccountingApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const state = useAccountingState(currentUser.username, initialTab);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/5" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="flex items-center gap-4 px-6 h-14">
          <button onClick={onBack} className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <span className="text-white font-black uppercase tracking-widest text-sm">Kế toán</span>
          </div>
          <div className="flex gap-1 ml-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => state.setActiveTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${state.activeTab === t.id ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                style={state.activeTab === t.id ? { background: '#FF9500', color: 'white' } : {}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {state.loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : state.error ? (
          <div className="text-center py-20 text-red-400">{state.error}</div>
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
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AccountingApp;
