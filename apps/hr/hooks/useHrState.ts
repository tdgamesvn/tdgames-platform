import { useState, useEffect, useCallback } from 'react';
import { HrEmployee, HrDepartment, HrContract, HrEvaluation, HrReminder } from '@/types';
import * as svc from '../services/hrService';
import { setHashTab } from '@/App';

export type HrTab = 'employees' | 'employeeForm' | 'employeeDetail' | 'departments' | 'reminders' | 'quickAdd';
const VALID_TABS: HrTab[] = ['employees', 'employeeForm', 'employeeDetail', 'departments', 'reminders', 'quickAdd'];

export function useHrState(initialTab?: string | null) {
  const [activeTab, _setActiveTab] = useState<HrTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as HrTab)) return initialTab as HrTab;
    return 'employees';
  });
  const setActiveTab = useCallback((tab: HrTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Core data ──
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [contracts, setContracts] = useState<HrContract[]>([]);
  const [evaluations, setEvaluations] = useState<HrEvaluation[]>([]);
  const [reminders, setReminders] = useState<(HrReminder & { employee?: any })[]>([]);

  // ── Edit/Detail state ──
  const [editingEmployee, setEditingEmployee] = useState<HrEmployee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<HrEmployee | null>(null);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        svc.fetchEmployees(),
        svc.fetchDepartments(),
        svc.fetchReminders(),
      ]);
      if (results[0].status === 'fulfilled') setEmployees(results[0].value);
      else console.error('Failed to load employees:', results[0].reason);
      if (results[1].status === 'fulfilled') setDepartments(results[1].value);
      else console.error('Failed to load departments:', results[1].reason);
      if (results[2].status === 'fulfilled') setReminders((results[2].value as any[]).filter((r: any) => r.status !== 'dismissed'));
      else console.error('Failed to load reminders:', results[2].reason);
    } catch (e: any) {
      setToast({ message: e.message || 'Lỗi tải dữ liệu', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Employee CRUD ──
  const handleSaveEmployee = async (emp: Omit<HrEmployee, 'id' | 'employee_code' | 'created_at' | 'updated_at' | 'department'> & { _salaryAmounts?: Record<string, number>; _role?: string }) => {
    try {
      const { _salaryAmounts, ...empData } = emp as any;
      const saved = await svc.saveEmployee(empData);
      // Save salary records for new employee
      if (_salaryAmounts) {
        const today = new Date().toISOString().split('T')[0];
        for (const [componentId, amount] of Object.entries(_salaryAmounts)) {
          if ((amount as number) > 0) {
            try {
              await svc.saveEmployeeSalary({
                employee_id: saved.id, component_id: componentId,
                amount: amount as number, note: '',
                effective_from: today, effective_to: null,
              });
            } catch {}
          }
        }
      }
      setEmployees(prev => [...prev, saved].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setToast({ message: `Đã thêm ${saved.full_name} (${saved.employee_code})`, type: 'success' });
      setActiveTab('employees');
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateEmployee = async (id: string, updates: Partial<HrEmployee>) => {
    try {
      await svc.updateEmployee(id, updates);
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      setToast({ message: 'Đã cập nhật', type: 'success' });
      setEditingEmployee(null);
      setActiveTab('employees');
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await svc.deleteEmployee(id);
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: 'terminated' } : e));
      setToast({ message: 'Đã cho nghỉ việc (soft delete) — dữ liệu lịch sử được giữ lại', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleReactivateEmployee = async (id: string) => {
    try {
      await svc.reactivateEmployee(id);
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: 'active' } : e));
      setToast({ message: 'Đã kích hoạt lại nhân sự', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Department CRUD ──
  const handleSaveDepartment = async (dept: Omit<HrDepartment, 'id' | 'created_at'>) => {
    try {
      const saved = await svc.saveDepartment(dept);
      setDepartments(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setToast({ message: 'Đã thêm phòng ban', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });

    }
  };

  const handleUpdateDepartment = async (id: string, updates: Partial<HrDepartment>) => {
    try {
      await svc.updateDepartment(id, updates);
      setDepartments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      setToast({ message: 'Đã cập nhật phòng ban', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await svc.deleteDepartment(id);
      setDepartments(prev => prev.filter(d => d.id !== id));
      setToast({ message: 'Đã xóa phòng ban', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Contract helpers ──
  const loadContracts = useCallback(async (employeeId: string) => {
    try {
      const c = await svc.fetchContracts(employeeId);
      setContracts(c);
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  }, []);

  const handleSaveContract = async (c: Omit<HrContract, 'id' | 'created_at'>) => {
    try {
      const saved = await svc.saveContract(c);
      setContracts(prev => [saved, ...prev]);
      setToast({ message: 'Đã thêm hợp đồng', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateContract = async (id: string, updates: Partial<HrContract>) => {
    try {
      await svc.updateContract(id, updates);
      setContracts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      setToast({ message: 'Đã cập nhật hợp đồng', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteContract = async (id: string) => {
    try {
      await svc.deleteContract(id);
      setContracts(prev => prev.filter(c => c.id !== id));
      setToast({ message: 'Đã xóa hợp đồng', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Reminders ──
  const handleGenerateReminders = async () => {
    try {
      const count = await svc.generateReminders();
      const updated = await svc.fetchReminders();
      setReminders(updated.filter(r => r.status !== 'dismissed'));
      if (count > 0) setToast({ message: `Đã tạo ${count} nhắc nhở mới`, type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // Auto-scan khi chuyển sang tab reminders
  useEffect(() => {
    if (activeTab === 'reminders') {
      svc.generateReminders()
        .then(() => svc.fetchReminders())
        .then(data => setReminders(data.filter(r => r.status !== 'dismissed')))
        .catch(() => {}); // silent — không show toast khi auto-scan
    }
  }, [activeTab]);

  const handleDismissReminder = async (id: string) => {
    try {
      await svc.dismissReminder(id);
      setReminders(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Workforce Sync ──
  const handleSyncAllToWorkforce = async () => {
    try {
      const count = await svc.syncAllEmployeesToWorkforce();
      if (count > 0) {
        await loadAll();
        setToast({ message: `Đã đồng bộ ${count} nhân sự sang Workforce`, type: 'success' });
      } else {
        setToast({ message: 'Tất cả nhân sự đã được đồng bộ', type: 'success' });
      }
    } catch (e: any) {
      setToast({ message: `Lỗi đồng bộ: ${e.message}`, type: 'error' });
    }
  };

  // ── Filtered employees ──
  const filteredEmployees = employees.filter(e => {
    if (filterType && e.type !== filterType) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterDepartment && e.department_id !== filterDepartment) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.phone.includes(q)
      );
    }
    return true;
  });

  // ── Computed ──
  const pendingReminders = reminders.filter(r => r.status === 'pending');

  return {
    activeTab, setActiveTab,
    isLoading, toast, setToast,
    employees, filteredEmployees, departments,
    contracts, evaluations, reminders, pendingReminders,
    editingEmployee, setEditingEmployee,
    viewingEmployee, setViewingEmployee,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterStatus, setFilterStatus,
    filterDepartment, setFilterDepartment,
    handleSaveEmployee, handleUpdateEmployee, handleDeleteEmployee, handleReactivateEmployee,
    handleSaveDepartment, handleUpdateDepartment, handleDeleteDepartment,
    loadContracts,
    handleSaveContract, handleUpdateContract, handleDeleteContract,
    handleGenerateReminders, handleDismissReminder,
    handleSyncAllToWorkforce,
    loadAll,
  };
}
