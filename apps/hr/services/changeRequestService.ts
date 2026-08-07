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

export async function updateChangeRequestChanges(
  id: string,
  changes: Record<string, any>,
): Promise<HrChangeRequest> {
  const { data, error } = await supabase
    .from('hr_change_requests')
    .update({ changes })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*, employee:hr_employees(*)')
    .single();
  if (error) throw error;
  return data;
}

/** Edit salary on an already-approved request and re-apply to employee */
export async function editApprovedSalary(
  id: string,
  newSalaryComponents: Array<{ component_id: string; name: string; old_amount: number; new_amount: number }>,
): Promise<HrChangeRequest> {
  // 1. Fetch the approved request
  const { data: req, error: fetchErr } = await supabase
    .from('hr_change_requests')
    .select('*, employee:hr_employees(*)')
    .eq('id', id)
    .eq('status', 'approved')
    .single();
  if (fetchErr || !req) throw new Error(fetchErr?.message || 'Không tìm thấy đề xuất');

  // 2. Update the changes on the request record
  const updatedChanges = {
    ...req.changes,
    salary_components: newSalaryComponents,
  };
  const { error: updateErr } = await supabase
    .from('hr_change_requests')
    .update({ changes: updatedChanges })
    .eq('id', id);
  if (updateErr) throw updateErr;

  // 3. Re-apply: rotate salary for each component
  const empId = req.employee_id;
  const effDate = req.effective_date;
  for (const sc of newSalaryComponents) {
    await rotateSalary(empId, sc.component_id, sc.new_amount, effDate, 'Điều chỉnh lương (sửa đề xuất đã duyệt)');
  }

  // 4. Update employee.salary with new total
  const newTotal = newSalaryComponents.reduce((s, x) => s + x.new_amount, 0);
  await hrSvc.updateEmployee(empId, { salary: newTotal } as any);

  // 5. Add position history for the adjustment
  const prevTotal = (req.changes.salary_components || []).reduce((s: number, x: any) => s + (x.new_amount || 0), 0);
  await hrSvc.addPositionChange({
    employee_id: empId,
    change_type: 'salary',
    old_value: prevTotal.toLocaleString() + ' VNĐ',
    new_value: newTotal.toLocaleString() + ' VNĐ',
    effective_date: effDate,
    reason: 'Điều chỉnh lương (sửa đề xuất đã duyệt)',
  });

  return { ...req, changes: updatedChanges };
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
// ── Direct Salary Adjust (no change request) ─────────────
// ══════════════════════════════════════════════════════════

export async function directSalaryAdjust(
  empId: string,
  changedComponents: Array<{ component_id: string; name: string; old_amount: number; new_amount: number }>,
  effectiveDate: string,
  reason?: string,
): Promise<void> {
  // 1. Rotate salary for each changed component
  for (const sc of changedComponents) {
    await rotateSalary(empId, sc.component_id, sc.new_amount, effectiveDate, reason || 'Điều chỉnh lương trực tiếp');
  }

  // 2. Insert position history record
  const oldTotal = changedComponents.reduce((s, x) => s + x.old_amount, 0);
  const newTotal = changedComponents.reduce((s, x) => s + x.new_amount, 0);
  await hrSvc.addPositionChange({
    employee_id: empId,
    change_type: 'salary',
    old_value: oldTotal.toLocaleString() + ' VNĐ',
    new_value: newTotal.toLocaleString() + ' VNĐ',
    effective_date: effectiveDate,
    reason: reason || 'Điều chỉnh lương trực tiếp',
  });

  // 3. Update quick-access salary field on employee
  await hrSvc.updateEmployee(empId, { salary: newTotal } as any);
}

// ══════════════════════════════════════════════════════════
// ── Auto-apply (private) ─────────────────────────────────
// ══════════════════════════════════════════════════════════

/**
 * Đóng dòng lương cũ + mở dòng mới cho 1 component.
 * ponytail: qua RPC SECURITY DEFINER chứ không đọc/ghi bảng trực tiếp — role `hr`
 * duyệt được đơn nhưng KHÔNG có quyền trên hr_employee_salary
 * (migration 20260807100000). Đây cũng là 1 round-trip thay vì 3.
 */
async function rotateSalary(
  empId: string, componentId: string, newAmount: number,
  effectiveFrom: string, note: string,
): Promise<void> {
  const { error } = await supabase.rpc('hr_rotate_salary', {
    p_employee_id: empId,
    p_component_id: componentId,
    p_amount: newAmount,
    p_effective_from: effectiveFrom,
    p_note: note,
  });
  if (error) throw error;
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
