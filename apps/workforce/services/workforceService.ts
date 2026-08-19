import { getWorkspace } from '@/services/WorkspaceContext';
import { supabase } from '@/services/supabaseClient';
import { Worker, WorkerContract, WorkforceTask, TaskAssignee, Settlement } from '@/types';

// ── Workers ───────────────────────────────────────────────────
export async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('wf_workers')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

/**
 * Sync worker data from HR employees (hr_employees → wf_workers).
 * Matches by email. Updates phone, bank, tax_code if missing in wf_workers.
 * Returns number of workers updated.
 */
export async function syncWorkersFromHR(): Promise<number> {
  // 1. Fetch all workers
  const { data: workers, error: wErr } = await supabase
    .from('wf_workers')
    .select('*');
  if (wErr) throw wErr;
  if (!workers || workers.length === 0) return 0;

  // 2. Get matching HR employees (freelancers) by email
  const emails = workers.map(w => w.email).filter(Boolean);
  if (emails.length === 0) return 0;

  const { data: hrEmployees, error: hErr } = await supabase
    .from('hr_employees')
    .select('email, phone, bank_name, bank_account, bank_branch, tax_code, address, id_number, full_name, date_of_birth, gender')
    .in('email', emails);
  if (hErr) throw hErr;
  if (!hrEmployees || hrEmployees.length === 0) return 0;

  // 3. Build lookup by email
  const hrByEmail = new Map(hrEmployees.map(h => [h.email.toLowerCase(), h]));

  // 4. Update workers with missing fields from HR
  let updatedCount = 0;
  for (const w of workers) {
    const hr = hrByEmail.get(w.email?.toLowerCase());
    if (!hr) continue;

    const updates: Record<string, any> = {};
    if (!w.phone && hr.phone) updates.phone = hr.phone;
    if (!w.bank_name && hr.bank_name) updates.bank_name = hr.bank_name;
    if (!w.bank_account && hr.bank_account) updates.bank_account = hr.bank_account;
    if (!w.tax_code && hr.tax_code) updates.tax_code = hr.tax_code;

    if (Object.keys(updates).length > 0) {
      const { error: uErr } = await supabase
        .from('wf_workers')
        .update(updates)
        .eq('id', w.id);
      if (!uErr) updatedCount++;
    }
  }

  return updatedCount;
}

export async function saveWorker(w: Omit<Worker, 'id' | 'created_at'>): Promise<Worker> {
  const { data, error } = await supabase
    .from('wf_workers')
    .insert({ entity: getWorkspace(), ...w })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, updates: Partial<Worker>): Promise<void> {
  const { error } = await supabase.from('wf_workers').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteWorker(id: string): Promise<void> {
  const { error } = await supabase.from('wf_workers').delete().eq('id', id);
  if (error) throw error;
}

// ── Contracts ─────────────────────────────────────────────────
export async function fetchContracts(workerId?: string): Promise<WorkerContract[]> {
  let q = supabase.from('wf_contracts').select('*').order('start_date', { ascending: false });
  if (workerId) q = q.eq('worker_id', workerId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveContract(c: Omit<WorkerContract, 'id' | 'created_at'>): Promise<WorkerContract> {
  const { data, error } = await supabase
    .from('wf_contracts')
    .insert(c)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContract(id: string, updates: Partial<WorkerContract>): Promise<void> {
  const { error } = await supabase.from('wf_contracts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('wf_contracts').delete().eq('id', id);
  if (error) throw error;
}

// ── Tasks ─────────────────────────────────────────────────────
const TASK_SELECT = '*, assignees:wf_task_assignees(*, worker:wf_workers(*))';

/** Chia đều n người, dư dồn người đầu để tổng luôn = 100. splitShares(3) → [34,33,33] */
export const splitShares = (n: number): number[] => {
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? 100 - base * (n - 1) : base));
};

export async function fetchTasks(): Promise<WorkforceTask[]> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .select(TASK_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveTask(
  t: Omit<WorkforceTask, 'id' | 'created_at' | 'updated_at' | 'assignees'>,
  assignees: Pick<TaskAssignee, 'worker_id' | 'share_pct'>[] = []
): Promise<WorkforceTask> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .insert(t)
    .select('id')
    .single();
  if (error) throw error;
  if (assignees.length > 0) await setTaskAssignees(data.id, assignees);
  const { data: full, error: fErr } = await supabase
    .from('wf_tasks').select(TASK_SELECT).eq('id', data.id).single();
  if (fErr) throw fErr;
  return full;
}

/** Task này có người đó làm không? */
export const taskHasWorker = (t: WorkforceTask, workerId: string): boolean =>
  (t.assignees || []).some(a => a.worker_id === workerId);

/**
 * Task của 1 người, `price`/`bonus` đã quy về đúng phần chia của người đó.
 * Mặc định bỏ task người đó đã được trả; `keepIds` để giữ task đang nằm trong settlement.
 */
export function tasksForWorker(
  tasks: WorkforceTask[], workerId: string, keepIds: string[] = []
): WorkforceTask[] {
  return tasks.flatMap(t => {
    const a = (t.assignees || []).find(x => x.worker_id === workerId);
    if (!a) return [];
    if (a.payment_status === 'paid' && !keepIds.includes(t.id!)) return [];
    const r = Number(a.share_pct || 0) / 100;
    return [{ ...t, price: (t.price || 0) * r, bonus: (t.bonus || 0) * r }];
  });
}

/** Đặt lại danh sách người làm của task (delete-then-insert, giống updateSettlementTasks). */
export async function setTaskAssignees(
  taskId: string,
  list: Pick<TaskAssignee, 'worker_id' | 'share_pct'>[]
): Promise<void> {
  // Giữ payment_status của người đang có — sếp chỉnh % không được xoá dấu đã trả.
  const { data: old } = await supabase
    .from('wf_task_assignees').select('worker_id, payment_status').eq('task_id', taskId);
  const paidBy = new Map((old || []).map((a: any) => [a.worker_id, a.payment_status]));

  await supabase.from('wf_task_assignees').delete().eq('task_id', taskId);
  if (list.length === 0) return;
  const { error } = await supabase.from('wf_task_assignees').insert(
    list.map(a => ({
      task_id: taskId,
      worker_id: a.worker_id,
      share_pct: a.share_pct,
      payment_status: paidBy.get(a.worker_id) || 'unpaid',
    }))
  );
  if (error) throw error;
}

/** Đánh dấu trả/chưa trả cho 1 người trên nhiều task. Trigger tự lo wf_tasks.payment_status. */
export async function setAssigneePayment(
  taskIds: string[], workerId: string, status: 'unpaid' | 'paid'
): Promise<void> {
  if (taskIds.length === 0) return;
  const { error } = await supabase
    .from('wf_task_assignees').update({ payment_status: status })
    .in('task_id', taskIds).eq('worker_id', workerId);
  if (error) throw error;
}

/** Toggle cả task (mọi người) — dùng cho nút "Đã TT/Chưa TT" trong TaskList. */
export async function setTaskPayment(taskId: string, status: 'unpaid' | 'paid'): Promise<void> {
  const { error } = await supabase
    .from('wf_task_assignees').update({ payment_status: status }).eq('task_id', taskId);
  if (error) throw error;
}

export async function updateTask(id: string, updates: Partial<WorkforceTask>): Promise<void> {
  const { assignees, ...clean } = updates as any;
  const { error } = await supabase
    .from('wf_tasks')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('wf_tasks').delete().eq('id', id);
  if (error) throw error;
}

// ── Settlements ───────────────────────────────────────────────
export async function fetchSettlements(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('wf_settlements')
    .select('*, worker:wf_workers(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export function computeSettlementTotals(
  totalAmount: number,
  bonusType: 'percent' | 'amount',
  bonusValue: number,
  taxRate: number
) {
  const bonusAmount = bonusType === 'percent'
    ? Math.round(totalAmount * bonusValue / 100)
    : bonusValue;
  const beforeTax = totalAmount + bonusAmount;
  const taxAmount = Math.round(beforeTax * taxRate / 100);
  const netAmount = beforeTax - taxAmount;
  return { bonusAmount, taxAmount, netAmount };
}

export async function createSettlement(
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
): Promise<Settlement> {
  const { bonusAmount, taxAmount, netAmount } = computeSettlementTotals(totalAmount, bonusType, bonusValue, taxRate);

  // 1. Create settlement
  const { data: settlement, error: sErr } = await supabase
    .from('wf_settlements')
    .insert({
      worker_id: workerId,
      project_name: projectName,
      period,
      total_tasks: taskIds.length,
      total_amount: totalAmount,
      currency,
      notes,
      bonus_type: bonusType,
      bonus_value: bonusValue,
      bonus_amount: bonusAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      net_amount: netAmount,
      account_type: accountType,
    })
    .select('*, worker:wf_workers(*)')
    .single();
  if (sErr) throw sErr;

  // 2. Link tasks (NO auto-mark paid — user decides when to mark paid)
  if (taskIds.length > 0) {
    const links = taskIds.map(tid => ({
      settlement_id: settlement.id,
      task_id: tid,
    }));
    const { error: lErr } = await supabase.from('wf_settlement_tasks').insert(links);
    if (lErr) throw lErr;
  }

  return settlement;
}

export async function updateSettlement(id: string, updates: Partial<Settlement>): Promise<void> {
  const { worker, tasks, ...clean } = updates as any;
  const { error } = await supabase.from('wf_settlements').update(clean).eq('id', id);
  if (error) throw error;

  // When marking as 'paid', also mark all linked tasks as paid + sync to expense
  if (updates.status === 'paid') {
    // 1. Mark PHẦN CỦA NGƯỜI NÀY trong task là paid (không đè cả task — người khác
    //    cùng task chưa được trả thì vẫn phải quyết toán được). Trigger lo wf_tasks.
    const { data: links } = await supabase.from('wf_settlement_tasks').select('task_id').eq('settlement_id', id);
    if (links && links.length > 0) {
      const { data: s } = await supabase.from('wf_settlements').select('worker_id').eq('id', id).single();
      if (s) await setAssigneePayment(links.map((l: any) => l.task_id), s.worker_id, 'paid');
    }

    // 2. Backfill expense_id — DB trigger `sync_settlement_to_expense` đã tự tạo
    // (idempotent, có check tồn tại) dòng expense_expenses ngay trong lệnh update
    // status ở trên. KHÔNG insert lại ở đây nữa — trước đây code này tự insert
    // thêm 1 dòng expense song song với trigger, gây trùng 2 dòng chi phí cho
    // mỗi settlement (trigger không tự ghi lại expense_id nên guard cũ luôn thấy null).
    const { data: existing, error: fetchErr } = await supabase
      .from('wf_settlements')
      .select('expense_id')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (existing && !existing.expense_id) {
      const { data: exp } = await supabase
        .from('expense_expenses')
        .select('id')
        .eq('source_type', 'settlement')
        .eq('source_id', id)
        .maybeSingle();
      if (exp) {
        await supabase.from('wf_settlements').update({ expense_id: exp.id }).eq('id', id);
      }
    }
  }
}

export async function deleteSettlement(id: string): Promise<void> {
  // 1. Get settlement info (to clean up linked expense)
  const { data: settlement } = await supabase
    .from('wf_settlements')
    .select('expense_id, worker_id')
    .eq('id', id)
    .maybeSingle();

  // 2. Get linked task IDs before deleting
  const { data: links } = await supabase.from('wf_settlement_tasks').select('task_id').eq('settlement_id', id);

  // 3. Delete link records
  await supabase.from('wf_settlement_tasks').delete().eq('settlement_id', id);

  // 4. Rollback phần của người này về unpaid (đối xứng với updateSettlement)
  if (links && links.length > 0 && settlement?.worker_id) {
    await setAssigneePayment(links.map((l: any) => l.task_id), settlement.worker_id, 'unpaid');
  }

  // 5. Delete auto-created expense (source_type = settlement only)
  if (settlement?.expense_id) {
    const { data: exp } = await supabase
      .from('expense_expenses')
      .select('id, source_type')
      .eq('id', settlement.expense_id)
      .maybeSingle();
    if (exp?.source_type === 'settlement') {
      await supabase.from('expense_expenses').delete().eq('id', settlement.expense_id);
    }
  }

  // 6. Delete settlement
  const { error } = await supabase.from('wf_settlements').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchSettlementTasks(settlementId: string): Promise<WorkforceTask[]> {
  const { data, error } = await supabase
    .from('wf_settlement_tasks')
    .select(`task:wf_tasks(${TASK_SELECT})`)
    .eq('settlement_id', settlementId);
  if (error) throw error;
  return (data || []).map((d: any) => d.task);
}

export async function updateSettlementTasks(
  settlementId: string,
  newTaskIds: string[],
  totalAmount: number,
  currency: string,
  bonusType: 'percent' | 'amount',
  bonusValue: number,
  taxRate: number,
  notes: string,
  accountType: 'company' | 'personal'
): Promise<void> {
  const { bonusAmount, taxAmount, netAmount } = computeSettlementTotals(totalAmount, bonusType, bonusValue, taxRate);

  // 1. Remove old task links
  await supabase.from('wf_settlement_tasks').delete().eq('settlement_id', settlementId);

  // 2. Insert new task links
  if (newTaskIds.length > 0) {
    const links = newTaskIds.map(tid => ({ settlement_id: settlementId, task_id: tid }));
    const { error: lErr } = await supabase.from('wf_settlement_tasks').insert(links);
    if (lErr) throw lErr;
  }

  // 3. Update settlement record
  const { error } = await supabase.from('wf_settlements').update({
    total_tasks: newTaskIds.length,
    total_amount: totalAmount,
    currency,
    bonus_type: bonusType,
    bonus_value: bonusValue,
    bonus_amount: bonusAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    net_amount: netAmount,
    notes,
    account_type: accountType,
  }).eq('id', settlementId);
  if (error) throw error;
}
