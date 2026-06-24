import React, { useState, useEffect } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser, CrmActivity } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useCrmState, CrmTab } from '../hooks/useCrmState';
import ClientList from './ClientList';
import EmailOutreach from './EmailOutreach';
import ClientForm from './ClientForm';
import ProjectList from './ProjectList';
import DocumentList from './DocumentList';
import PaymentTracker from './PaymentTracker';
import ActivityTimeline from './ActivityTimeline';
import { fetchActivities } from '../services/crmService';
import DealPipeline from './DealPipeline';
import HelpPanel from '@/components/HelpPanel';
import { CRM_HELP } from '../helpContent';

interface CrmAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_MAP: Record<CrmTab, string> = {
  dashboard:  'dashboard',
  deals:      'deals',
  clients:    'history',
  projects:   'tasks',
  documents:  'settings',
  payments:   'activity',
  activities: 'board',
  outreach:   'outreach',
};

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Tổng quan',
  deals:    'Deal Pipeline',
  history:  'Khách hàng',
  tasks:    'Dự án',
  settings: 'Tài liệu',
  activity: 'Thanh toán',
  board:    'Hoạt động',
  outreach: '📧 Outreach',
};

const REVERSE_TAB: Record<string, CrmTab> = {
  dashboard: 'dashboard',
  deals:     'deals',
  history:   'clients',
  tasks:     'projects',
  settings:  'documents',
  activity:  'payments',
  board:     'activities',
  outreach:  'outreach',
};

const TYPE_ICON: Record<string, { icon: string; label: string; color: string }> = {
  call:          { icon: '📞', label: 'Gọi điện',    color: '#34C759' },
  email:         { icon: '📧', label: 'Email',       color: '#0A84FF' },
  meeting:       { icon: '🤝', label: 'Meeting',     color: '#FF9500' },
  note:          { icon: '📝', label: 'Ghi chú',     color: '#AF52DE' },
  status_change: { icon: '🔄', label: 'Đổi trạng thái', color: '#FF3B30' },
};

const GlobalActivityFeed: React.FC<{ clients: any[]; actor: string }> = ({ clients, actor }) => {
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState('');

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c.name]));

  useEffect(() => {
    setIsLoading(true);
    fetchActivities(undefined, 100).then(data => { setActivities(data); setIsLoading(false); }).catch(() => setIsLoading(false));
  }, []);

  const filtered = filterType ? activities.filter(a => a.activity_type === filterType) : activities;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fadeInUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
          Hoạt động gần đây
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setFilterType('')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              background: !filterType ? 'rgba(255,149,0,0.15)' : 'transparent',
              border: `1px solid ${!filterType ? 'rgba(255,149,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: !filterType ? '#FF9500' : '#888', cursor: 'pointer',
            }}
          >Tất cả</button>
          {Object.entries(TYPE_ICON).filter(([k]) => k !== 'status_change').map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? '' : key)}
              style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                background: filterType === key ? meta.color + '15' : 'transparent',
                border: `1px solid ${filterType === key ? meta.color + '30' : 'rgba(255,255,255,0.08)'}`,
                color: filterType === key ? meta.color : '#888', cursor: 'pointer',
              }}
            >{meta.icon} {meta.label}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#888', fontSize: '13px' }} className="animate-pulse">Đang tải hoạt động...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#161616', border: '1px solid #222', borderRadius: '16px' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có hoạt động nào</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>Mở chi tiết khách hàng để thêm ghi chú, cuộc gọi, meeting...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(act => {
            const meta = TYPE_ICON[act.activity_type] || TYPE_ICON.note;
            return (
              <div key={act.id} style={{
                display: 'flex', gap: '16px', alignItems: 'flex-start',
                padding: '16px 20px', background: '#161616', border: '1px solid #222',
                borderRadius: '12px', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = meta.color + '40')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  background: meta.color + '15', border: `1px solid ${meta.color}25`,
                }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#F5F5F5' }}>{act.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          background: '#FF950015', color: '#FF9500',
                        }}>
                          {clientMap[act.client_id] || 'Unknown'}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          background: meta.color + '15', color: meta.color,
                        }}>{meta.label}</span>
                        <span style={{ fontSize: '11px', color: '#666' }}>
                          {formatDate(act.activity_date)} • {formatTime(act.activity_date)}
                        </span>
                        {act.actor && <span style={{ fontSize: '11px', color: '#555' }}>bởi {act.actor}</span>}
                      </div>
                    </div>
                  </div>
                  {act.description && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '8px', lineHeight: '1.5' }}>{act.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CrmApp: React.FC<CrmAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = useCrmState(initialTab);
  const [showForm, setShowForm] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const navbarTab = TAB_MAP[state.activeTab];
  const isBd = currentUser.role === 'bd';
  const accessibleTabs = isBd
    ? ['dashboard', 'deals', 'history', 'tasks', 'settings', 'board', 'outreach']
    : ['dashboard', 'deals', 'history', 'tasks', 'settings', 'activity', 'board', 'outreach'];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {/* Toast */}
      {state.toast && (
        <ToastNotification
          message={{ text: state.toast.message, type: state.toast.type }}
          onDismiss={() => state.setToast(null)}
        />
      )}

      {/* Navbar */}
      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={navbarTab as any}
        accessibleTabs={accessibleTabs as any}
        onTabChange={(tab) => {
          const crmTab = REVERSE_TAB[tab];
          if (crmTab) {
            setShowForm(false);
            state.setEditingClient(null);
            state.setActiveTab(crmTab);
          }
        }}
        onLogout={onBack}
        onBack={onBack}
        appName="CRM"
        tabLabels={TAB_LABELS}
        onHelp={() => setHelpOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {/* ── Clients Tab ── */}
        {state.activeTab === 'clients' && (
          <>
            {showForm || state.editingClient ? (
              <ClientForm
                editingClient={state.editingClient}
                onSave={async (data) => { const c = await state.handleCreateClient(data); setShowForm(false); return c; }}
                onUpdate={(id, data) => { state.handleUpdateClient(id, data); setShowForm(false); state.setEditingClient(null); }}
                onCancel={() => { setShowForm(false); state.setEditingClient(null); }}
                onCreateContact={state.handleCreateContact}
                onUpdateContact={state.handleUpdateContact}
                onDeleteContact={state.handleDeleteContact}
                actor={currentUser.username}
              />
            ) : (
              <ClientList
                clients={state.filteredClients}
                isLoading={state.isLoading}
                searchQuery={state.searchQuery} setSearchQuery={state.setSearchQuery}
                filterStatus={state.filterStatus} setFilterStatus={state.setFilterStatus}
                filterIndustry={state.filterIndustry} setFilterIndustry={state.setFilterIndustry}
                industries={state.industries}
                statusCounts={state.statusCounts}
                totalClients={state.clients.length}
                onEdit={(c) => state.setEditingClient(c)}
                onDelete={state.handleDeleteClient}
                onRefresh={state.loadClients}
                onAdd={() => { state.setEditingClient(null); setShowForm(true); }}
                currentUser={currentUser}
              />
            )}
          </>
        )}

        {/* ── Projects Tab ── */}
        {state.activeTab === 'projects' && (
          <ProjectList clients={state.clients} currentUser={currentUser} />
        )}

        {/* ── Documents Tab ── */}
        {state.activeTab === 'documents' && (
          <DocumentList clients={state.clients} currentUser={currentUser} />
        )}

        {/* ── Payments Tab ── */}
        {state.activeTab === 'payments' && (
          <PaymentTracker clients={state.clients} />
        )}

        {/* ── Activities Tab ── */}
        {state.activeTab === 'activities' && (
          <GlobalActivityFeed clients={state.clients} actor={currentUser.username} />
        )}

        {/* ── Deal Pipeline Tab ── */}
        {state.activeTab === 'deals' && (
          <DealPipeline currentUser={currentUser} clients={state.clients} />
        )}

        {/* ── Email Outreach Tab ── */}
        {state.activeTab === 'outreach' && (
          <EmailOutreach clients={state.clients} />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="CRM"
        appIcon="🤝"
        contents={CRM_HELP}
        activeTabId={navbarTab}
      />
    </div>
  );
};

export default CrmApp;
