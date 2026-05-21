import React, { useState, useEffect } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import HelpPanel from '@/components/HelpPanel';
import { fetchCompanyProfiles, CompanyProfile } from '../services/companyService';
import InfoTab from './InfoTab';
import DocumentsTab from './DocumentsTab';
import BankTab from './BankTab';
import { COMPANY_HELP } from '../helpContent';

interface CompanyAppProps {
  currentUser: AccountUser;
  onBack: () => void;
}

type Tab = 'info' | 'documents' | 'bank';

const TAB_MAP: Record<Tab, string> = {
  info: 'history',
  documents: 'activity',
  bank: 'settings',
};

const REVERSE_TAB: Record<string, Tab> = {
  history: 'info',
  activity: 'documents',
  settings: 'bank',
};

const TAB_LABELS: Record<string, string> = {
  history: '🏢 Thông tin',
  activity: '📁 Giấy tờ',
  settings: '🏦 Ngân hàng',
};

const CompanyApp: React.FC<CompanyAppProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const { rate: vcbRate, loading: vcbRateLoading } = useExchangeRate();
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'ke_toan';
  const navbarTab = TAB_MAP[activeTab];

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchCompanyProfiles();
        setCompanies(data);
        // Default to TD GAMES (primary)
        const primary = data.find(c => c.is_primary) ?? data[0];
        if (primary) setSelectedId(primary.id);
      } catch (e: any) {
        setToast({ message: e.message || 'Lỗi tải dữ liệu', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selectedCompany = companies.find(c => c.id === selectedId);

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
        activeTab={navbarTab as any}
        accessibleTabs={['history', 'activity', 'settings'] as any}
        onTabChange={tab => {
          const t = REVERSE_TAB[tab];
          if (t) setActiveTab(t);
        }}
        onLogout={onBack}
        onBack={onBack}
        vcbRate={vcbRate}
        vcbRateLoading={vcbRateLoading}
        appName="Công ty"
        tabLabels={TAB_LABELS}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-32 text-neutral-600 text-sm">Đang tải...</div>
        ) : !selectedCompany ? (
          <div className="flex items-center justify-center py-32 text-neutral-600 text-sm">Không có dữ liệu công ty</div>
        ) : (
          <>
            {/* Entity switcher (nếu có nhiều pháp nhân) */}
            {companies.length > 1 && (
              <div className="flex gap-2 mb-8">
                {companies.map(c => (
                  <button key={c.id} onClick={() => setSelectedId(c.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    style={selectedId === c.id
                      ? { background: '#FF9500', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#888' }}>
                    {c.entity_short || c.entity_name_vn}
                    {c.is_primary && <span className="ml-1 opacity-60">★</span>}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'info' && (
              <InfoTab
                company={selectedCompany}
                canEdit={canEdit}
                onUpdated={updated => setCompanies(cs => cs.map(c => c.id === updated.id ? updated : c))}
              />
            )}
            {activeTab === 'documents' && (
              <DocumentsTab
                company={selectedCompany}
                canEdit={canEdit}
                username={currentUser.username}
              />
            )}
            {activeTab === 'bank' && (
              <BankTab company={selectedCompany} />
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
        appName="Công ty"
        appIcon="🏢"
        contents={COMPANY_HELP}
        activeTabId={navbarTab}
      />
    </div>
  );
};

export default CompanyApp;
