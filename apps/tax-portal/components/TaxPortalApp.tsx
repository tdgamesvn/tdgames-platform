import React, { useState } from 'react';
import { AccountUser } from '@/types';
import TaxPortalOverviewTab from './TaxPortalOverviewTab';
import TaxPortalInvoiceTab from './TaxPortalInvoiceTab';
import TaxPortalExpenseTab from './TaxPortalExpenseTab';
import TaxPortalBankTab from './TaxPortalBankTab';
import TaxPortalAssetsTab from './TaxPortalAssetsTab';
import TaxPortalPayrollTab from './TaxPortalPayrollTab';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

type Tab = 'overview' | 'invoice' | 'expense' | 'bank' | 'assets' | 'payroll';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'invoice', label: 'Hoá đơn' },
  { id: 'expense', label: 'Chi phí' },
  { id: 'bank', label: 'Ngân hàng' },
  { id: 'assets', label: 'Tài sản & BHXH' },
  { id: 'payroll', label: 'Lương / TNCN' },
];

const TaxPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <button onClick={onBack} className="text-neutral-medium text-xs font-bold uppercase tracking-wider mb-4">
        ← Trang chủ
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">🧾 Tax Portal</h1>
          <p className="text-neutral-medium text-sm">Xin chào {currentUser.username} — chỉ xem, có thể xuất dữ liệu</p>
        </div>
      </div>
      <div className="flex gap-2 mb-6 border-b border-white/8 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-black uppercase whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-neutral-medium hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <TaxPortalOverviewTab />}
      {tab === 'invoice' && <TaxPortalInvoiceTab />}
      {tab === 'expense' && <TaxPortalExpenseTab />}
      {tab === 'bank' && <TaxPortalBankTab />}
      {tab === 'assets' && <TaxPortalAssetsTab />}
      {tab === 'payroll' && <TaxPortalPayrollTab />}
    </div>
  );
};

export default TaxPortalApp;
