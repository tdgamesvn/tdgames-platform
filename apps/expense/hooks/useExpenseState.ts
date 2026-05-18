import { useState, useEffect, useCallback } from 'react';
import { ExpenseCategory, ExpenseRecord, RecurringExpense } from '@/types';
import {
  fetchCategories,
  fetchExpenses,
  saveExpense,
  updateExpense,
  deleteExpense,
  fetchRecurringExpenses,
  saveRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  saveCategory,
  updateCategory,
  deleteCategory,
} from '../services/expenseService';
import { setHashTab } from '@/App';

export type ExpenseTab = 'dashboard' | 'list' | 'add' | 'recurring' | 'categories' | 'reports' | 'fxrates';

const VALID_TABS: ExpenseTab[] = ['dashboard', 'list', 'add', 'recurring', 'categories', 'reports', 'fxrates'];

export function useExpenseState(currentUser: string, initialTab?: string | null) {
  const [activeTab, _setActiveTab] = useState<ExpenseTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as ExpenseTab)) return initialTab as ExpenseTab;
    return 'dashboard';
  });
  const setActiveTab = useCallback((tab: ExpenseTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Filters ──
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'revenue'>('all');
  const [filterSource, setFilterSource] = useState('');

  // ── Editing ──
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

  // ── Load Data ──
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cats, exps, recs] = await Promise.all([
        fetchCategories(),
        fetchExpenses(),
        fetchRecurringExpenses(),
      ]);
      setCategories(cats);
      setExpenses(exps);
      setRecurring(recs);
    } catch (err: any) {
      notify(err.message || 'Lỗi tải dữ liệu', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Notify ──
  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Expense CRUD ──
  const handleSaveExpense = async (data: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at' | 'category'>) => {
    try {
      await saveExpense({ ...data, created_by: currentUser });
      await loadAll();
      notify('Đã lưu chi phí');
      setActiveTab('list');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleUpdateExpense = async (id: string, data: Partial<ExpenseRecord>) => {
    try {
      await updateExpense(id, data);
      await loadAll();
      notify('Đã cập nhật');
      setEditingExpense(null);
      setActiveTab('list');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpense(id);
      await loadAll();
      notify('Đã xoá');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleToggleStatus = async (exp: ExpenseRecord) => {
    const next = exp.status === 'pending' ? 'approved' : exp.status === 'approved' ? 'paid' : 'pending';
    await handleUpdateExpense(exp.id!, { status: next });
  };

  // ── Recurring CRUD ──
  const handleSaveRecurring = async (data: Omit<RecurringExpense, 'id' | 'created_at' | 'category'>) => {
    try {
      await saveRecurringExpense(data);
      await loadAll();
      notify('Đã lưu mẫu chi phí định kỳ');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleUpdateRecurring = async (id: string, data: Partial<RecurringExpense>) => {
    try {
      await updateRecurringExpense(id, data);
      await loadAll();
      notify('Đã cập nhật');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleDeleteRecurring = async (id: string) => {
    try {
      await deleteRecurringExpense(id);
      await loadAll();
      notify('Đã xoá');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  // ── Category CRUD ──
  const handleSaveCategory = async (data: Omit<ExpenseCategory, 'id'>) => {
    try {
      await saveCategory(data);
      await loadAll();
      notify('Đã thêm danh mục');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleUpdateCategory = async (id: string, data: Partial<ExpenseCategory>) => {
    try {
      await updateCategory(id, data);
      await loadAll();
      notify('Đã cập nhật danh mục');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteCategory(id);
      await loadAll();
      notify('Đã xoá danh mục');
    } catch (err: any) { notify(err.message, 'error'); }
  };

  // ── Filtered list ──
  const filteredExpenses = expenses.filter((exp) => {
    if (filterCategory && exp.category_id !== filterCategory) return false;
    if (filterStatus && exp.status !== filterStatus) return false;
    if (filterDateFrom && exp.expense_date < filterDateFrom) return false;
    if (filterDateTo && exp.expense_date > filterDateTo) return false;
    if (filterType !== 'all' && (exp.type || 'expense') !== filterType) return false;
    if (filterSource) {
      const src = exp.source_type || 'manual';
      if (src !== filterSource) return false;
    }
    return true;
  });

  // ── Totals ──
  const totalVND = filteredExpenses.filter(e => e.currency === 'VND').reduce((s, e) => s + e.amount, 0);
  const totalUSD = filteredExpenses.filter(e => e.currency === 'USD').reduce((s, e) => s + e.amount, 0);
  const revenueVND = filteredExpenses.filter(e => e.type === 'revenue' && e.currency === 'VND').reduce((s, e) => s + e.amount, 0);
  const revenueUSD = filteredExpenses.filter(e => e.type === 'revenue' && e.currency === 'USD').reduce((s, e) => s + e.amount, 0);
  const expenseVND = filteredExpenses.filter(e => e.type !== 'revenue' && e.currency === 'VND').reduce((s, e) => s + e.amount, 0);
  const expenseUSD = filteredExpenses.filter(e => e.type !== 'revenue' && e.currency === 'USD').reduce((s, e) => s + e.amount, 0);

  return {
    activeTab, setActiveTab,
    categories, expenses, filteredExpenses, recurring,
    isLoading, toast, setToast,
    filterCategory, setFilterCategory,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filterStatus, setFilterStatus,
    filterType, setFilterType,
    filterSource, setFilterSource,
    editingExpense, setEditingExpense,
    totalVND, totalUSD,
    revenueVND, revenueUSD, expenseVND, expenseUSD,
    handleSaveExpense, handleUpdateExpense, handleDeleteExpense, handleToggleStatus,
    handleSaveRecurring, handleUpdateRecurring, handleDeleteRecurring,
    handleSaveCategory, handleUpdateCategory, handleDeleteCategory,
    notify, loadAll,
  };
}
