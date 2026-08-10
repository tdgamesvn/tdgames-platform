import { supabase } from '@/services/supabaseClient';
import { Worker, WorkerContract, WorkforceTask, Settlement } from '@/types';

// ── Resolve worker ───────────────────────────────────────────
// ponytail: dùng RPC my_worker_id() (khớp wf_workers.email với claim email của JWT) thay vì
// user_metadata.worker_id — 0/23 user có field đó nên portal luôn rỗng. RPC dùng chung logic
// với RLS wf_* (migration 20260809180000) nên không lệch quyền.
export async function fetchMyWorkerId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_worker_id');
  if (error) throw error;
  return (data as string) || null;
}

// ── My Tasks ─────────────────────────────────────────────────
export async function fetchMyTasks(workerId: string): Promise<WorkforceTask[]> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .select('*, worker:wf_workers(*)')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── My Settlements ───────────────────────────────────────────
export async function fetchMySettlements(workerId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('wf_settlements')
    .select('*, worker:wf_workers(*)')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchSettlementTasks(settlementId: string): Promise<WorkforceTask[]> {
  const { data, error } = await supabase
    .from('wf_settlement_tasks')
    .select('task:wf_tasks(*, worker:wf_workers(*))')
    .eq('settlement_id', settlementId);
  if (error) throw error;
  return (data || []).map((d: any) => d.task);
}

// ── My Contracts ─────────────────────────────────────────────
export async function fetchMyContracts(workerId: string): Promise<WorkerContract[]> {
  const { data, error } = await supabase
    .from('wf_contracts')
    .select('*')
    .eq('worker_id', workerId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Dashboard Stats ──────────────────────────────────────────
export interface FreelancerDashboardStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  totalSettlements: number;
  totalEarnings: number;    // sum of net_amount for paid settlements
  pendingPayment: number;   // sum of net_amount for unpaid settlements
  monthlyEarnings: { month: string; amount: number }[];
}

export async function fetchDashboardStats(workerId: string): Promise<FreelancerDashboardStats> {
  // Fetch all tasks
  const { data: tasks } = await supabase
    .from('wf_tasks')
    .select('status, price, closed_date')
    .eq('worker_id', workerId);

  // Fetch all settlements
  const { data: settlements } = await supabase
    .from('wf_settlements')
    .select('status, net_amount, period, created_at')
    .eq('worker_id', workerId);

  const taskList = tasks || [];
  const settlementList = settlements || [];

  const totalTasks = taskList.length;
  const completedTasks = taskList.filter(t => t.status === 'completed' || t.status === 'approved').length;
  const inProgressTasks = taskList.filter(t => t.status === 'in_progress').length;

  const totalSettlements = settlementList.length;
  const totalEarnings = settlementList
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + (s.net_amount || 0), 0);
  const pendingPayment = settlementList
    .filter(s => s.status !== 'paid')
    .reduce((sum, s) => sum + (s.net_amount || 0), 0);

  // Monthly earnings  (last 6 months)
  const now = new Date();
  const monthlyEarnings: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `T${d.getMonth() + 1}`;
    const amount = settlementList
      .filter(s => s.status === 'paid' && s.period === period)
      .reduce((sum, s) => sum + (s.net_amount || 0), 0);
    monthlyEarnings.push({ month: label, amount });
  }

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    totalSettlements,
    totalEarnings,
    pendingPayment,
    monthlyEarnings,
  };
}
