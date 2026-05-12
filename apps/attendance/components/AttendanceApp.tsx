import React from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useAttendanceState, AttTab } from '../hooks/useAttendanceState';
import Dashboard from './Dashboard';
import ShiftManager from './ShiftManager';
import AttendanceLog from './AttendanceLog';
import MonthlySheet from './MonthlySheet';

import AttendanceReport from './AttendanceReport';
import LeaveApproval from './LeaveApproval';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_MAP: Record<AttTab, string> = {
  dashboard: 'dashboard',
  log: 'history',
  shifts: 'activity',
  reports: 'recurring',
  leaves: 'tasks',
};

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  history: 'Bảng công',
  activity: 'Ca làm việc',
  recurring: 'Báo cáo',
  tasks: 'Nghỉ phép',
};

const REVERSE_TAB: Record<string, AttTab> = {
  dashboard: 'dashboard',
  history: 'log',
  activity: 'shifts',
  recurring: 'reports',
  tasks: 'leaves',
};

const AttendanceApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const state = useAttendanceState(initialTab);

  const navbarTab = TAB_MAP[state.activeTab];
  const accessibleTabs = ['dashboard', 'history', 'activity', 'recurring', 'tasks'];

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
          const attTab = REVERSE_TAB[tab];
          if (attTab) state.setActiveTab(attTab);
        }}
        onLogout={onBack}
        onBack={onBack}
        appName="CHẤM CÔNG"
        tabLabels={TAB_LABELS}
      />

      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {state.activeTab === 'dashboard' && (
          <Dashboard
            employees={state.employees}
            todayRecords={state.todayRecords}
            shifts={state.shifts}
            employeeShifts={state.employeeShifts}
            selectedDate={state.selectedDate}
            setSelectedDate={state.setSelectedDate}
            checkedInCount={state.checkedInCount}
            completedCount={state.completedCount}
            lateCount={state.lateCount}
            pendingRequestsCount={state.pendingRequests.length}
            onCheckIn={state.handleCheckIn}
            isLoading={state.isLoading}
          />
        )}

        {state.activeTab === 'log' && (
          <MonthlySheet employees={state.employees} />
        )}

        {state.activeTab === 'shifts' && (
          <ShiftManager
            shifts={state.shifts}
            employees={state.employees}
            employeeShifts={state.employeeShifts}
            onSave={state.handleSaveShift}
            onUpdate={state.handleUpdateShift}
            onDelete={state.handleDeleteShift}
            onAssign={state.handleSaveEmployeeShift}
            onDeleteAssignment={state.handleDeleteEmployeeShift}
          />
        )}



        {state.activeTab === 'reports' && (
          <AttendanceReport
            employees={state.employees}
            shifts={state.shifts}
          />
        )}

        {state.activeTab === 'leaves' && (
          <LeaveApproval
            currentUser={currentUser}
            onToast={(msg, type) => state.setToast({ message: msg, type })}
          />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Consulting • Attendance System • v1.0
      </footer>
    </div>
  );
};

export default AttendanceApp;
