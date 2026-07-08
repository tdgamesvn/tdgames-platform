import React, { useState } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { Navbar } from '@/components/Navbar';
import TaxPortalOverviewTab from './TaxPortalOverviewTab';
import TaxPortalInvoiceTab from './TaxPortalInvoiceTab';
import TaxPortalExpenseTab from './TaxPortalExpenseTab';
import TaxPortalBankTab from './TaxPortalBankTab';
import TaxPortalAssetsTab from './TaxPortalAssetsTab';
import TaxPortalPayrollTab from './TaxPortalPayrollTab';
import TaxPortalEmployeeTab from './TaxPortalEmployeeTab';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

type Tab = 'overview' | 'invoice' | 'expense' | 'bank' | 'assets' | 'payroll' | 'employees';

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Tổng quan',
  invoice: 'Hoá đơn',
  expense: 'Chi phí',
  bank: 'Ngân hàng',
  assets: 'Tài sản & BHXH',
  payroll: 'Lương / TNCN',
  employees: 'Nhân sự',
};
const ACCESSIBLE_TABS: Tab[] = ['overview', 'invoice', 'expense', 'bank', 'assets', 'payroll', 'employees'];

const TaxPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={tab}
        accessibleTabs={ACCESSIBLE_TABS as any}
        onTabChange={(t) => setTab(t as Tab)}
        onLogout={onBack}
        onBack={onBack}
        appName="Tax Portal"
        tabLabels={TAB_LABELS}
      />
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter" style={{ color: '#FF9500' }}>
            🧾 {TAB_LABELS[tab]}
          </h2>
          <p className="text-sm text-neutral-medium mt-1">
            Xin chào {currentUser.username} — chỉ xem, có thể xuất dữ liệu
          </p>
        </div>
        {tab === 'overview' && <TaxPortalOverviewTab />}
        {tab === 'invoice' && <TaxPortalInvoiceTab />}
        {tab === 'expense' && <TaxPortalExpenseTab />}
        {tab === 'bank' && <TaxPortalBankTab />}
        {tab === 'assets' && <TaxPortalAssetsTab />}
        {tab === 'payroll' && <TaxPortalPayrollTab />}
        {tab === 'employees' && <TaxPortalEmployeeTab />}
      </main>
      <footer className="py-12 border-t border-white/5 text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>
    </div>
  );
};

export default TaxPortalApp;
