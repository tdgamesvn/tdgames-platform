import React from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useHrState, HrTab } from '../hooks/useHrState';
import EmployeeList from './EmployeeList';
import EmployeeForm from './EmployeeForm';
import EmployeeDetail from './EmployeeDetail';
import DepartmentManager from './DepartmentManager';
import ReminderDashboard from './ReminderDashboard';
import QuickAddEmployee from './QuickAddEmployee';
import HelpPanel from '@/components/HelpPanel';
import { HR_HELP } from '../helpContent';
import EvalTab from './EvalTab';
import ChangeRequestTab from './ChangeRequestTab';

interface HrAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_MAP: Record<HrTab, string> = {
  employees: 'history',
  employeeForm: 'edit',
  employeeDetail: 'recurring',
  departments: 'activity',
  reminders: 'dashboard',
  quickAdd: 'edit',
  evaluation: 'tasks',
  changeRequests: 'requests',
};

const TAB_LABELS: Record<string, string> = {
  history: 'Nhân sự',
  edit: 'Thêm/Sửa',
  activity: 'Phòng ban',
  dashboard: 'Nhắc việc',
  tasks: 'Đánh giá',
  requests: 'Đề xuất',
};

const REVERSE_TAB: Record<string, HrTab> = {
  history: 'employees',
  edit: 'employeeForm',
  recurring: 'employeeDetail',
  activity: 'departments',
  dashboard: 'reminders',
  tasks: 'evaluation',
  requests: 'changeRequests',
};

const HrApp: React.FC<HrAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = useHrState(initialTab);
  const [helpOpen, setHelpOpen] = React.useState(false);

  const navbarTab = TAB_MAP[state.activeTab];
  const accessibleTabs = ['history', 'activity', 'dashboard', 'tasks', 'requests'];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden transition-colors duration-500" style={{ backgroundColor: '#0F0F0F' }}>
      <AppBackground />
      {state.toast && (
        <ToastNotification
          message={{ text: state.toast.message, type: state.toast.type }}
          onDismiss={() => state.setToast(null)}
        />
      )}

      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={navbarTab as any}
        accessibleTabs={accessibleTabs as any}
        onTabChange={(tab) => {
          const hrTab = REVERSE_TAB[tab];
          if (hrTab) {
            state.setEditingEmployee(null);
            state.setViewingEmployee(null);
            state.setActiveTab(hrTab);
          }
        }}
        onLogout={onBack}
        onBack={onBack}
        appName="HR"
        tabLabels={TAB_LABELS}
        onHelp={() => setHelpOpen(true)}
      />

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {state.activeTab === 'employees' && (
          <EmployeeList
            employees={state.filteredEmployees}
            departments={state.departments}
            isLoading={state.isLoading}
            searchQuery={state.searchQuery}
            setSearchQuery={state.setSearchQuery}
            filterType={state.filterType}
            setFilterType={state.setFilterType}
            filterStatus={state.filterStatus}
            setFilterStatus={state.setFilterStatus}
            filterDepartment={state.filterDepartment}
            setFilterDepartment={state.setFilterDepartment}
            totalCount={state.employees.length}
            onView={(e) => { state.setViewingEmployee(e); state.setActiveTab('employeeDetail'); }}
            onEdit={(e) => { state.setEditingEmployee(e); state.setActiveTab('employeeForm'); }}
            onDelete={state.handleDeleteEmployee}
            onAdd={() => { state.setEditingEmployee(null); state.setActiveTab('employeeForm'); }}
            onQuickAdd={() => state.setActiveTab('quickAdd')}
            onSyncWorkforce={state.handleSyncAllToWorkforce}
            onRefresh={state.loadAll}
            onToast={(msg, type) => state.setToast({ message: msg, type })}
            pendingReminders={state.pendingReminders.length}
          />
        )}

        {state.activeTab === 'employeeForm' && (
          <EmployeeForm
            editingEmployee={state.editingEmployee}
            departments={state.departments}
            contracts={state.contracts}
            loadContracts={state.loadContracts}
            onSave={state.handleSaveEmployee}
            onUpdate={state.handleUpdateEmployee}
            onCancel={() => { state.setEditingEmployee(null); state.setActiveTab('employees'); }}
            onSaveContract={state.handleSaveContract}
            onUpdateContract={state.handleUpdateContract}
            onDeleteContract={state.handleDeleteContract}
          />
        )}

        {state.activeTab === 'employeeDetail' && state.viewingEmployee && (
          <EmployeeDetail
            employee={state.viewingEmployee}
            departments={state.departments}
            currentUser={currentUser}
            onBack={() => { state.setViewingEmployee(null); state.setActiveTab('employees'); }}
            onEdit={(e) => { state.setEditingEmployee(e); state.setActiveTab('employeeForm'); }}
          />
        )}

        {state.activeTab === 'departments' && (
          <DepartmentManager
            departments={state.departments}
            employees={state.employees}
            onSave={state.handleSaveDepartment}
            onUpdate={state.handleUpdateDepartment}
            onDelete={state.handleDeleteDepartment}
          />
        )}

        {state.activeTab === 'reminders' && (
          <ReminderDashboard
            reminders={state.pendingReminders}
            onGenerate={state.handleGenerateReminders}
            onDismiss={state.handleDismissReminder}
          />
        )}

        {state.activeTab === 'quickAdd' && (
          <QuickAddEmployee
            departments={state.departments}
            onSave={state.handleSaveEmployee}
            onCancel={() => state.setActiveTab('employees')}
          />
        )}

        {state.activeTab === 'evaluation' && (
          <EvalTab
            employees={state.employees}
            currentUser={currentUser}
            onToast={(msg, type) => state.setToast({ message: msg, type })}
          />
        )}

        {state.activeTab === 'changeRequests' && (
          <ChangeRequestTab
            requests={state.changeRequests}
            employees={state.employees}
            departments={state.departments}
            currentUser={currentUser}
            onRefresh={state.loadChangeRequests}
            onToast={(msg, type) => state.setToast({ message: msg, type })}
          />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Games • Enterprise Platform • v3.0
      </footer>

      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        appName="HR"
        appIcon="👥"
        contents={HR_HELP}
        activeTabId={navbarTab}
      />
    </div>
  );
};

export default HrApp;
