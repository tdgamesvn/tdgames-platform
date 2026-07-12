import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import { useState, useEffect, useCallback } from 'react';
import { Worker, WorkerContract, WorkforceTask, Settlement, ProjectAcceptance } from '@/types';
import * as svc from '../services/workforceService';
import * as paSvc from '../services/projectAcceptanceService';
import { supabase } from '@/services/supabaseClient';
import { setHashTab } from '@/App';

export type WorkforceTab = 'workers' | 'workerForm' | 'tasks' | 'settlements' | 'projectAcceptance' | 'financials' | 'config';

const VALID_TABS: WorkforceTab[] = ['workers', 'workerForm', 'tasks', 'settlements', 'projectAcceptance', 'financials', 'config'];

export function useWorkforceState(currentUsername: string, initialTab?: string | null) {
  const { workspace } = useWorkspace();
  const [activeTab, _setActiveTab] = useState<WorkforceTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as WorkforceTab)) return initialTab as WorkforceTab;
    return 'workers';
  });
  const setActiveTab = useCallback((tab: WorkforceTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Data ──
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [contracts, setContracts] = useState<WorkerContract[]>([]);
  const [tasks, setTasks] = useState<WorkforceTask[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [projectAcceptances, setProjectAcceptances] = useState<ProjectAcceptance[]>([]);

  // ── Edit state ──
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  // ── Filters ──
  const [filterWorkerType, setFilterWorkerType] = useState('');
  const [filterTaskStatus, setFilterTaskStatus] = useState('');
  const [filterTaskWorker, setFilterTaskWorker] = useState('');

  // ── Load ──
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [w, t, s, pa] = await Promise.all([
        svc.fetchWorkers(),
        svc.fetchTasks(),
        svc.fetchSettlements(),
        paSvc.fetchProjectAcceptances(),
      ]);
      setWorkers(w);
      setTasks(t);
      setSettlements(s);
      setProjectAcceptances(pa);

      // Auto-sync from HR in background (non-blocking)
      svc.syncWorkersFromHR().then(count => {
        if (count > 0) {
          console.log(`[Sync] Updated ${count} workers from HR`);
          // Reload workers to reflect synced data
          svc.fetchWorkers().then(updated => setWorkers(updated));
        }
      }).catch(() => {});
    } catch (e: any) {
      setToast({ message: e.message || 'Lỗi tải dữ liệu', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Supabase Realtime subscription for wf_tasks ──
  useEffect(() => {
    const channel = supabase
      .channel('wf_tasks_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wf_tasks' }, (payload) => {
        console.log('[Realtime] Task inserted:', payload.new);
        setTasks(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === payload.new.id)) return prev;
          return [payload.new as WorkforceTask, ...prev];
        });
        setToast({ message: `⚡ Task mới: ${(payload.new as any).title}`, type: 'success' });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wf_tasks' }, (payload) => {
        console.log('[Realtime] Task updated:', payload.new);
        setTasks(prev => prev.map(t => t.id === payload.new.id ? (payload.new as WorkforceTask) : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'wf_tasks' }, (payload) => {
        console.log('[Realtime] Task deleted:', payload.old);
        setTasks(prev => prev.filter(t => t.id !== (payload.old as any).id));
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadContracts = useCallback(async (workerId: string) => {
    try {
      const c = await svc.fetchContracts(workerId);
      setContracts(c);
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  }, []);

  // ── Worker CRUD ──
  const handleSaveWorker = async (w: Omit<Worker, 'id' | 'created_at'>) => {
    try {
      const saved = await svc.saveWorker(w);
      setWorkers(prev => [...prev, saved].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setToast({ message: 'Đã thêm nhân sự', type: 'success' });
      setActiveTab('workers');
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateWorker = async (id: string, updates: Partial<Worker>) => {
    try {
      await svc.updateWorker(id, updates);
      setWorkers(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
      setToast({ message: 'Đã cập nhật', type: 'success' });
      setEditingWorker(null);
      setActiveTab('workers');
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteWorker = async (id: string) => {
    try {
      await svc.deleteWorker(id);
      setWorkers(prev => prev.filter(w => w.id !== id));
      setToast({ message: 'Đã xóa', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Sync from HR ──
  const handleSyncFromHR = async () => {
    try {
      const count = await svc.syncWorkersFromHR();
      if (count > 0) {
        const updated = await svc.fetchWorkers();
        setWorkers(updated);
        setToast({ message: `✅ Đã đồng bộ ${count} nhân sự từ HR`, type: 'success' });
      } else {
        setToast({ message: 'Dữ liệu đã đồng bộ rồi, không có gì mới.', type: 'success' });
      }
    } catch (e: any) {
      setToast({ message: e.message || 'Lỗi đồng bộ từ HR', type: 'error' });
    }
  };

  // ── Contract CRUD ──
  const handleSaveContract = async (c: Omit<WorkerContract, 'id' | 'created_at'>) => {
    try {
      const saved = await svc.saveContract(c);
      setContracts(prev => [saved, ...prev]);
      setToast({ message: 'Đã thêm hợp đồng', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateContract = async (id: string, updates: Partial<WorkerContract>) => {
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

  // ── Task CRUD ──
  const handleSaveTask = async (t: Omit<WorkforceTask, 'id' | 'created_at' | 'updated_at' | 'worker'>) => {
    try {
      const saved = await svc.saveTask(t);
      setTasks(prev => [saved, ...prev]);
      setToast({ message: 'Đã thêm task', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<WorkforceTask>) => {
    try {
      await svc.updateTask(id, updates);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      setToast({ message: 'Đã cập nhật task', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await svc.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      setToast({ message: 'Đã xóa task', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Settlement ──
  const handleCreateSettlement = async (
    workerId: string,
    projectName: string,
    period: string,
    taskIds: string[],
    totalAmount: number,
    currency: string,
    notes: string,
    bonusType: 'percent' | 'amount' = 'amount',
    bonusValue: number = 0,
    taxRate: number = 10,
    accountType: 'company' | 'personal' = 'company'
  ) => {
    try {
      const saved = await svc.createSettlement(workerId, projectName, period, taskIds, totalAmount, currency, notes, bonusType, bonusValue, taxRate, accountType);
      setSettlements(prev => [saved, ...prev]);
      // Refresh tasks since they've been marked approved
      const updatedTasks = await svc.fetchTasks();
      setTasks(updatedTasks);
      setToast({ message: 'Đã tạo nghiệm thu', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateSettlement = async (id: string, updates: Partial<Settlement>) => {
    try {
      await svc.updateSettlement(id, updates);
      setSettlements(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      // Refresh tasks if status changed (may affect payment_status)
      if (updates.status) {
        const updatedTasks = await svc.fetchTasks();
        setTasks(updatedTasks);
      }
      setToast({ message: 'Đã cập nhật nghiệm thu', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteSettlement = async (id: string) => {
    try {
      await svc.deleteSettlement(id);
      setSettlements(prev => prev.filter(s => s.id !== id));
      // Refresh tasks — deleted settlement rollbacks tasks to unpaid
      const updatedTasks = await svc.fetchTasks();
      setTasks(updatedTasks);
      setToast({ message: 'Đã xóa nghiệm thu', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Project Acceptance ──
  const handleCreateProjectAcceptance = async (
    projectName: string,
    clientName: string,
    period: string,
    taskIds: string[],
    totalAmount: number,
    currency: string,
    notes: string,
    clientPrices?: Record<string, number>,
    accountType: 'company' | 'personal' = 'company'
  ) => {
    try {
      const saved = await paSvc.createProjectAcceptance(projectName, clientName, period, taskIds, totalAmount, currency, notes, clientPrices, accountType);
      setProjectAcceptances(prev => [saved, ...prev]);
      setToast({ message: 'Created project acceptance', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleUpdateProjectAcceptance = async (id: string, updates: Partial<ProjectAcceptance>) => {
    try {
      await paSvc.updateProjectAcceptance(id, updates);
      setProjectAcceptances(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      setToast({ message: 'Đã cập nhật nghiệm thu dự án', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  const handleDeleteProjectAcceptance = async (id: string) => {
    try {
      await paSvc.deleteProjectAcceptance(id);
      setProjectAcceptances(prev => prev.filter(a => a.id !== id));
      setToast({ message: 'Đã xóa nghiệm thu dự án', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };

  // ── Filtered data ──
  // Tách sổ: workers theo entity; tasks/settlements kế thừa qua worker membership
  const wsWorkers = workers.filter(w => matchesWorkspace((w as any).entity, workspace));
  const wIds = new Set(wsWorkers.map(w => w.id));
  const wsTasks = tasks.filter(t => wIds.has(t.worker_id));
  const wsSettlements = settlements.filter(s => wIds.has((s as any).worker_id));

  const filteredWorkers = wsWorkers.filter(w => {
    if (filterWorkerType && w.type !== filterWorkerType) return false;
    return true;
  });

  const filteredTasks = wsTasks.filter(t => {
    if (filterTaskStatus && t.status !== filterTaskStatus) return false;
    if (filterTaskWorker && t.worker_id !== filterTaskWorker) return false;
    return true;
  });

  return {
    activeTab, setActiveTab,
    isLoading, toast, setToast,
    workers: wsWorkers, filteredWorkers,
    contracts, loadContracts,
    tasks: wsTasks, filteredTasks,
    settlements: wsSettlements,
    projectAcceptances,
    editingWorker, setEditingWorker,
    selectedWorkerId, setSelectedWorkerId,
    filterWorkerType, setFilterWorkerType,
    filterTaskStatus, setFilterTaskStatus,
    filterTaskWorker, setFilterTaskWorker,
    handleSaveWorker, handleUpdateWorker, handleDeleteWorker, handleSyncFromHR,
    handleSaveContract, handleUpdateContract, handleDeleteContract,
    handleSaveTask, handleUpdateTask, handleDeleteTask,
    handleCreateSettlement, handleUpdateSettlement, handleDeleteSettlement,
    handleCreateProjectAcceptance, handleUpdateProjectAcceptance, handleDeleteProjectAcceptance,
    loadAll,
  };
}
