import { supabase } from '@/services/supabaseClient';
import { Worker, WorkerContract, WorkforceTask, Settlement } from '@/types';

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
    .insert(w)
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
export async function fetchTasks(): Promise<WorkforceTask[]> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .select('*, worker:wf_workers(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveTask(t: Omit<WorkforceTask, 'id' | 'created_at' | 'updated_at' | 'worker'>): Promise<WorkforceTask> {
  const { data, error } = await supabase
    .from('wf_tasks')
    .insert(t)
    .select('*, worker:wf_workers(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: Partial<WorkforceTask>): Promise<void> {
  const { worker, ...clean } = updates as any;
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

// ── Expense sync helpers ─────────────────────────────────────
async function ensureFreelancerCategory(): Promise<string | null> {
  const { data } = await supabase
    .from('expense_categories')
    .select('id')
    .eq('name', 'Chi phí Freelancer')
    .maybeSingle();
  if (data) return data.id;
  const { data: created } = await supabase
    .from('expense_categories')
    .insert({ name: 'Chi phí Freelancer', color: '#8B5CF6', icon: '🧑‍💻' })
    .select('id')
    .single();
  return created?.id ?? null;
}

export async function updateSettlement(id: string, updates: Partial<Settlement>): Promise<void> {
  const { worker, tasks, ...clean } = updates as any;
  const { error } = await supabase.from('wf_settlements').update(clean).eq('id', id);
  if (error) throw error;

  // When marking as 'paid', also mark all linked tasks as paid + sync to expense
  if (updates.status === 'paid') {
    // 1. Mark linked tasks as paid
    const { data: links } = await supabase.from('wf_settlement_tasks').select('task_id').eq('settlement_id', id);
    if (links && links.length > 0) {
      const taskIds = links.map((l: any) => l.task_id);
      await supabase
        .from('wf_tasks')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .in('id', taskIds);
    }

    // 2. Sync expense record: tạo mới nếu chưa có, hoặc cập nhật status='paid' nếu đã có
    const { data: existing, error: fetchErr } = await supabase
      .from('wf_settlements')
      .select('expense_id, net_amount, currency, period, account_type, worker:wf_workers(full_name)')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    if (existing) {
      if (!existing.expense_id) {
        // Chưa có expense → tạo mới với status='paid'
        const categoryId = await ensureFreelancerCategory();
        const workerName = (existing.worker as any)?.full_name || 'Freelancer';
        const { data: expenseRow, error: insertErr } = await supabase
          .from('expense_expenses')
          .insert({
            title: `Freelancer: ${workerName} — ${existing.period}`,
            amount: existing.net_amount,
            currency: existing.currency,
            expense_date: new Date().toISOString().split('T')[0],
            category_id: categoryId,
            type: 'expense',
            source_type: 'settlement',
            source_id: id,
            status: 'paid',
            vendor: workerName,
            project: '',
            client_name: '',
            payment_method: 'CK',
            account_type: existing.account_type || 'company',
            notes: `Tự động từ Settlement ${id}`,
            receipt_url: '',
            created_by: 'system',
          })
          .select('id')
          .single();
        if (insertErr) throw insertErr;

        if (expenseRow) {
          await supabase.from('wf_settlements').update({ expense_id: expenseRow.id }).eq('id', id);
        }
      } else {
        // Đã có expense_id → cập nhật status='paid' (fix: trước đây bỏ qua bước này)
        await supabase
          .from('expense_expenses')
          .update({ status: 'paid' })
          .eq('id', existing.expense_id);
      }
    }
  }
}

export async function deleteSettlement(id: string): Promise<void> {
  // 1. Get settlement info (to clean up linked expense)
  const { data: settlement } = await supabase
    .from('wf_settlements')
    .select('expense_id')
    .eq('id', id)
    .maybeSingle();

  // 2. Get linked task IDs before deleting
  const { data: links } = await supabase.from('wf_settlement_tasks').select('task_id').eq('settlement_id', id);

  // 3. Delete link records
  await supabase.from('wf_settlement_tasks').delete().eq('settlement_id', id);

  // 4. Rollback linked tasks to unpaid
  if (links && links.length > 0) {
    const taskIds = links.map((l: any) => l.task_id);
    await supabase
      .from('wf_tasks')
      .update({ payment_status: 'unpaid', updated_at: new Date().toISOString() })
      .in('id', taskIds);
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
    .select('task:wf_tasks(*, worker:wf_workers(*))')
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
