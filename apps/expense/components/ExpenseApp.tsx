import React, { useState } from 'react';
import AppBackground from '@/components/AppBackground';
import { AccountUser } from '@/types';
import { ToastNotification } from '@/components/ToastNotification';
import { Navbar } from '@/components/Navbar';
import { useExpenseState, ExpenseTab } from '../hooks/useExpenseState';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import ExpenseList from './ExpenseList';
import ExpenseForm from './ExpenseForm';
import ExpenseRecurring from './ExpenseRecurring';
import ExpenseCategoryManager from './ExpenseCategoryManager';
import ExpenseDashboard from './ExpenseDashboard';
import ExpenseReports from './ExpenseReports';

interface ExpenseAppProps {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TAB_MAP: Record<ExpenseTab, string> = {
  dashboard: 'overview',
  list: 'history',
  add: 'history',
  recurring: 'recurring',
  categories: 'activity',
  reports: 'reports',
};

const TAB_LABELS: Record<string, string> = {
  overview: 'Dashboard',
  history: 'Danh sách',
  recurring: 'Định kỳ',
  activity: 'Danh mục',
  reports: 'Báo cáo',
};

const REVERSE_TAB: Record<string, ExpenseTab> = {
  overview: 'dashboard',
  history: 'list',
  recurring: 'recurring',
  activity: 'categories',
  reports: 'reports',
};

const ExpenseApp: React.FC<ExpenseAppProps> = ({ currentUser, onBack, initialTab }) => {
  const state = useExpenseState(currentUser.username, initialTab);
  const [showForm, setShowForm] = useState(false);

  // ── Live VCB Exchange Rate (shared via Context) ──
  const { rate: vcbRate, loading: vcbRateLoading, avgUsdVnd } = useExchangeRate();

  const navbarTab = TAB_MAP[state.activeTab];
  const accessibleTabs = (['overview', 'history', 'recurring', 'activity', 'reports'] as const).map(t => t);

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

      {/* Shared Navbar — same as Invoice */}
      <Navbar
        theme="dark"
        currentUser={currentUser}
        activeTab={navbarTab as any}
        accessibleTabs={accessibleTabs as any}
        onTabChange={(tab) => {
          const expTab = REVERSE_TAB[tab];
          if (expTab) {
            setShowForm(false);
            state.setEditingExpense(null);
            state.setActiveTab(expTab);
          }
        }}
        onLogout={onBack}
        vcbRate={vcbRate}
        vcbRateLoading={vcbRateLoading}
        onBack={onBack}
        appName="Expense"
        tabLabels={TAB_LABELS}
      />

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">
        {state.activeTab === 'dashboard' && (
          <ExpenseDashboard
            expenses={state.expenses}
            categories={state.categories}
            isLoading={state.isLoading}
            onNavigateToList={() => state.setActiveTab('list')}
            vcbAvgRate={avgUsdVnd}
          />
        )}
        {state.activeTab === 'list' && (
          <>
            {showForm || state.editingExpense ? (
              <ExpenseForm
                categories={state.categories}
                editingExpense={state.editingExpense}
                onSave={(data) => { state.handleSaveExpense(data); setShowForm(false); }}
                onUpdate={(id, data) => { state.handleUpdateExpense(id, data); setShowForm(false); state.setEditingExpense(null); }}
                onCancel={() => { setShowForm(false); state.setEditingExpense(null); }}
              />
            ) : (
              <ExpenseList
                expenses={state.filteredExpenses}
                categories={state.categories}
                isLoading={state.isLoading}
                filterCategory={state.filterCategory} setFilterCategory={state.setFilterCategory}
                filterDateFrom={state.filterDateFrom} setFilterDateFrom={state.setFilterDateFrom}
                filterDateTo={state.filterDateTo} setFilterDateTo={state.setFilterDateTo}
                filterStatus={state.filterStatus} setFilterStatus={state.setFilterStatus}
                filterType={state.filterType} setFilterType={state.setFilterType}
                filterSource={state.filterSource} setFilterSource={state.setFilterSource}
                totalVND={state.totalVND} totalUSD={state.totalUSD}
                revenueVND={state.revenueVND} revenueUSD={state.revenueUSD}
                expenseVND={state.expenseVND} expenseUSD={state.expenseUSD}
                onEdit={(exp) => { state.setEditingExpense(exp); }}
                onDelete={state.handleDeleteExpense}
                onToggleStatus={state.handleToggleStatus}
                onRefresh={state.loadAll}
                onAdd={() => { state.setEditingExpense(null); setShowForm(true); }}
                vcbAvgRate={avgUsdVnd}
              />
            )}
          </>
        )}
        {state.activeTab === 'recurring' && (
          <ExpenseRecurring
            recurring={state.recurring}
            categories={state.categories}
            onSave={state.handleSaveRecurring}
            onUpdate={state.handleUpdateRecurring}
            onDelete={state.handleDeleteRecurring}
          />
        )}
        {state.activeTab === 'categories' && (
          <ExpenseCategoryManager
            categories={state.categories}
            onSave={state.handleSaveCategory}
            onUpdate={state.handleUpdateCategory}
            onDelete={state.handleDeleteCategory}
          />
        )}
        {state.activeTab === 'reports' && (
          <ExpenseReports
            expenses={state.expenses}
            categories={state.categories}
          />
        )}
      </main>

      <footer className="py-12 border-t text-center opacity-30 text-[9px] font-black uppercase tracking-[0.5em]">
        TD Consulting • Enterprise Platform • v3.0
      </footer>
    </div>
  );
};

export default ExpenseApp;
