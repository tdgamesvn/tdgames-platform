import React from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import { useWorkforceState, WorkforceTab } from '../hooks/useWorkforceState';
import WorkerList from './WorkerList';
import WorkerForm from './WorkerForm';
import TaskList from './TaskList';
import SettlementManager from './SettlementManager';
import ProjectAcceptanceManager from './ProjectAcceptanceManager';
import ClickUpConfig from './ClickUpConfig';
import { FinancialDashboard } from './FinancialDashboard';

interface WorkforceAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_MAP: Record<WorkforceTab, string> = {
  workers: 'history',
  workerForm: 'edit',
  tasks: 'recurring',
  settlements: 'activity',
  projectAcceptance: 'reports',
  financials: 'overview',
  config: 'dashboard',
};

const TAB_LABELS: Record<string, string> = {
  history: 'Nhân sự',
  edit: 'Thêm/Sửa',
  recurring: 'Task',
  activity: 'Nghiệm thu',
  reports: 'NT Dự Án',
  overview: 'Tổng Quan',
  dashboard: 'Cấu hình',
};

const REVERSE_TAB: Record<string, WorkforceTab> = {
  history: 'workers',
  edit: 'workerForm',
  recurring: 'tasks',
  activity: 'settlements',
  reports: 'projectAcceptance',
  overview: 'financials',
  dashboard: 'config',
};

const WorkforceApp: React.FC<WorkforceAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = useWorkforceState(currentUser.username, initialTab);

  // ── Live VCB Exchange Rate (shared via Context) ──
  const { rate: vcbRate, loading: vcbRateLoading, avgUsdVnd } = useExchangeRate();

  const navbarTab = TAB_MAP[state.activeTab];
  const accessibleTabs = (['history', 'recurring', 'activity', 'reports', 'overview', 'dashboard'] as const).map(t => t);

  const showToast = (message: string, type: 'success' | 'error') => {
    state.setToast({ message, type });
  };

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

      {/* Shared Navbar */}
      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={navbarTab as any}
        accessibleTabs={accessibleTabs as any}
        onTabChange={(tab) => {
          const wfTab = REVERSE_TAB[tab];
          if (wfTab === 'workerForm') state.setEditingWorker(null);
          state.setActiveTab(wfTab);
        }}
        onLogout={onBack}
        vcbRate={vcbRate}
        vcbRateLoading={vcbRateLoading}
        onBack={onBack}
        appName="Workforce"
        tabLabels={TAB_LABELS}
      />

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {state.activeTab === 'workers' && (
          <WorkerList
            workers={state.filteredWorkers}
            isLoading={state.isLoading}
            filterType={state.filterWorkerType}
            setFilterType={state.setFilterWorkerType}
            onEdit={(w) => { state.setEditingWorker(w); state.setActiveTab('workerForm'); }}
            onDelete={state.handleDeleteWorker}
            onToggleActive={(w) => state.handleUpdateWorker(w.id!, { is_active: !w.is_active })}
            onRefresh={state.loadAll}
            onAdd={() => { state.setEditingWorker(null); state.setActiveTab('workerForm'); }}
            onSyncFromHR={state.handleSyncFromHR}
          />
        )}
        {state.activeTab === 'workerForm' && (
          <WorkerForm
            editingWorker={state.editingWorker}
            contracts={state.contracts}
            loadContracts={state.loadContracts}
            onSave={state.handleSaveWorker}
            onUpdate={state.handleUpdateWorker}
            onCancel={() => { state.setEditingWorker(null); state.setActiveTab('workers'); }}
            onSaveContract={state.handleSaveContract}
            onUpdateContract={state.handleUpdateContract}
            onDeleteContract={state.handleDeleteContract}
          />
        )}
        {state.activeTab === 'tasks' && (
          <TaskList
            tasks={state.filteredTasks}
            workers={state.workers}
            isLoading={state.isLoading}
            filterStatus={state.filterTaskStatus}
            setFilterStatus={state.setFilterTaskStatus}
            filterWorker={state.filterTaskWorker}
            setFilterWorker={state.setFilterTaskWorker}
            onUpdate={state.handleUpdateTask}
            onRefresh={state.loadAll}
            onToast={showToast}
            vcbSellRate={vcbRate ? avgUsdVnd : 0}
          />
        )}
        {state.activeTab === 'settlements' && (
          <SettlementManager
            settlements={state.settlements}
            workers={state.workers}
            tasks={state.tasks}
            vcbSellRate={vcbRate ? avgUsdVnd : 0}
            onCreateSettlement={state.handleCreateSettlement}
            onUpdateSettlement={state.handleUpdateSettlement}
            onDeleteSettlement={state.handleDeleteSettlement}
          />
        )}
        {state.activeTab === 'projectAcceptance' && (
          <ProjectAcceptanceManager
            acceptances={state.projectAcceptances}
            tasks={state.tasks}
            vcbSellRate={vcbRate ? avgUsdVnd : 0}
            onCreateAcceptance={state.handleCreateProjectAcceptance}
            onUpdateAcceptance={state.handleUpdateProjectAcceptance}
            onDeleteAcceptance={state.handleDeleteProjectAcceptance}
          />
        )}

        {state.activeTab === 'financials' && (
          <FinancialDashboard vcbAvgRate={avgUsdVnd} />
        )}

        {state.activeTab === 'config' && (
          <ClickUpConfig onToast={showToast} />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Consulting • Enterprise Platform • v3.0
      </footer>
    </div>
  );
};

export default WorkforceApp;
