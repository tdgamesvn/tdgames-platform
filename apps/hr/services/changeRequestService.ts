import { supabase } from '@/services/supabaseClient';
import { HrChangeRequest, HrChangeRequestStatus } from '@/types';
import * as hrSvc from './hrService';

// ══════════════════════════════════════════════════════════
// ── CRUD ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function fetchChangeRequests(
  status?: HrChangeRequestStatus
): Promise<HrChangeRequest[]> {
  let q = supabase
    .from('hr_change_requests')
    .select('*, employee:hr_employees(*)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchChangeRequestsByEmployee(
  employeeId: string
): Promise<HrChangeRequest[]> {
  const { data, error } = await supabase
    .from('hr_change_requests')
    .select('*, employee:hr_employees(*)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createChangeRequest(
  req: Omit<HrChangeRequest, 'id' | 'created_at' | 'employee'>
): Promise<HrChangeRequest> {
  const { data, error } = await supabase
    .from('hr_change_requests')
    .insert(req)
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChangeRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('hr_change_requests')
    .delete()
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════
// ── Approve / Reject ─────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function approveChangeRequest(
  id: string,
  approvedBy: string,
  note?: string
): Promise<HrChangeRequest> {
  const { data, error } = await supabase
    .from('hr_change_requests')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      approval_note: note || null,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;

  await applyChanges(data);
  return data;
}

export async function rejectChangeRequest(
  id: string,
  approvedBy: string,
  note?: string
): Promise<HrChangeRequest> {
  const { data, error } = await supabase
    .from('hr_change_requests')
    .update({
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      approval_note: note || null,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════
// ── Auto-apply (private) ─────────────────────────────────
// ══════════════════════════════════════════════════════════

/** Close old salary record and insert new one for a component */
async function rotateSalary(
  empId: string, componentId: string, newAmount: number,
  effectiveFrom: string, note: string,
): Promise<void> {
  // Close the currently-active record (effective_to = null) for this component
  const { data: existing } = await supabase
    .from('hr_employee_salary')
    .select('id')
    .eq('employee_id', empId)
    .eq('component_id', componentId)
    .is('effective_to', null);
  if (existing?.length) {
    for (const old of existing) {
      await supabase
        .from('hr_employee_salary')
        .update({ effective_to: effectiveFrom })
        .eq('id', old.id);
    }
  }
  // Insert new active record
  if (newAmount > 0) {
    await hrSvc.saveEmployeeSalary({
      employee_id: empId, component_id: componentId,
      amount: newAmount, note,
      effective_from: effectiveFrom, effective_to: null,
    });
  }
}

async function applyChanges(req: HrChangeRequest): Promise<void> {
  const c = req.changes;
  const empId = req.employee_id;
  const effDate = req.effective_date;

  switch (req.request_type) {
    case 'probation_end': {
      await hrSvc.updateEmployee(empId, { official_date: c.official_date } as any);
      if (c.salary_components?.length) {
        for (const sc of c.salary_components) {
          await rotateSalary(empId, sc.component_id, sc.new_amount, effDate, 'Lương chính thức (qua đề xuất)');
        }
        const oldTotal = c.salary_components.reduce((s: number, x: any) => s + (x.old_amount || 0), 0);
        const newTotal = c.salary_components.reduce((s: number, x: any) => s + (x.new_amount || 0), 0);
        await hrSvc.addPositionChange({
          employee_id: empId, change_type: 'salary',
          old_value: oldTotal.toLocaleString() + ' VNĐ',
          new_value: newTotal.toLocaleString() + ' VNĐ',
          effective_date: effDate,
          reason: req.reason || 'Lên chính thức (qua đề xuất)',
        });
      }
      break;
    }
    case 'salary_change': {
      if (c.salary_components?.length) {
        for (const sc of c.salary_components) {
          await rotateSalary(empId, sc.component_id, sc.new_amount, effDate, 'Điều chỉnh lương (qua đề xuất)');
        }
        const oldTotal = c.salary_components.reduce((s: number, x: any) => s + (x.old_amount || 0), 0);
        const newTotal = c.salary_components.reduce((s: number, x: any) => s + (x.new_amount || 0), 0);
        await hrSvc.addPositionChange({
          employee_id: empId, change_type: 'salary',
          old_value: oldTotal.toLocaleString() + ' VNĐ',
          new_value: newTotal.toLocaleString() + ' VNĐ',
          effective_date: effDate,
          reason: req.reason || 'Điều chỉnh lương (qua đề xuất)',
        });
      }
      break;
    }
    case 'promotion': {
      const updates: Record<string, any> = {};
      if (c.new_position) updates.position = c.new_position;
      if (c.new_level) updates.level = c.new_level;
      if (Object.keys(updates).length) {
        await hrSvc.updateEmployee(empId, updates as any);
      }
      if (c.salary_components?.length) {
        for (const sc of c.salary_components) {
          await rotateSalary(empId, sc.component_id, sc.new_amount, effDate, 'Thăng chức (qua đề xuất)');
        }
      }
      const snap = req.current_snapshot;
      await hrSvc.addPositionChange({
        employee_id: empId, change_type: 'position',
        old_value: `${snap.position || ''} / ${snap.level || ''}`,
        new_value: `${c.new_position || snap.position} / ${c.new_level || snap.level}`,
        effective_date: effDate,
        reason: req.reason || 'Thăng chức (qua đề xuất)',
      });
      break;
    }
    case 'department_transfer': {
      await hrSvc.updateEmployee(empId, { department_id: c.new_department_id } as any);
      const snap = req.current_snapshot;
      await hrSvc.addPositionChange({
        employee_id: empId, change_type: 'department',
        old_value: snap.department_name || '',
        new_value: c.new_department_name || '',
        effective_date: effDate,
        reason: req.reason || 'Chuyển phòng ban (qua đề xuất)',
      });
      break;
    }
    case 'termination': {
      await hrSvc.updateEmployee(empId, { status: 'inactive' } as any);
      await hrSvc.addPositionChange({
        employee_id: empId, change_type: 'position' as any,
        old_value: 'active', new_value: 'inactive',
        effective_date: c.termination_date || effDate,
        reason: c.termination_reason || req.reason || 'Nghỉ việc (qua đề xuất)',
      });
      break;
    }
  }
}
