import { supabase } from '@/services/supabaseClient';
import {
  HrEmployee, HrDepartment, HrContract, HrPositionHistory,
  HrEvaluation, HrProjectHistory, HrDocument, HrReminder,
  HrSalaryComponent, HrEmployeeSalary,
  HrDependent, HrDependentDocument,
  HrEquipmentHandover, HrEquipmentHandoverItem, HrParkingRegistration,
} from '@/types';

// ══════════════════════════════════════════════════════════════
// ── Helpers ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

/** Cross-check email: ensure email doesn't conflict between fulltime work_email and freelancer personal email */
export async function checkEmailConflict(email: string, excludeId?: string): Promise<string | null> {
  // Check if email is used as work_email by a fulltime/parttime employee
  const { data: workEmailMatch } = await supabase
    .from('hr_employees')
    .select('id, full_name, type')
    .eq('work_email', email)
    .limit(1);

  if (workEmailMatch?.length) {
    const match = workEmailMatch[0];
    if (match.id !== excludeId) {
      return `Email này đã được sử dụng làm email công việc bởi ${match.full_name} (${match.type})`;
    }
  }

  // Check if email is used as personal email by a freelancer
  const { data: personalEmailMatch } = await supabase
    .from('hr_employees')
    .select('id, full_name, type')
    .eq('email', email)
    .limit(1);

  if (personalEmailMatch?.length) {
    const match = personalEmailMatch[0];
    if (match.id !== excludeId) {
      return `Email này đã được sử dụng làm email cá nhân bởi ${match.full_name} (${match.type})`;
    }
  }

  return null; // No conflict
}

/** Disable Auth user via edge function (ban - prevents login but keeps account) */
async function disableAuthUser(email: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'disable', email }),
      }
    );
    const result = await res.json();
    if (result.success) {
      console.log(`[Auth] ${result.disabled ? 'Disabled' : 'No'} auth user for ${email}`);
    } else {
      console.warn(`[Auth] Failed to disable auth user for ${email}:`, result.error);
    }
  } catch (err) {
    console.warn('[Auth] Failed to disable auth user:', err);
  }
}

/** Re-enable Auth user via edge function (unban) */
async function enableAuthUser(email: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'enable', email }),
      }
    );
    const result = await res.json();
    if (result.success) {
      console.log(`[Auth] ${result.enabled ? 'Re-enabled' : 'No'} auth user for ${email}`);
    } else {
      console.warn(`[Auth] Failed to enable auth user for ${email}:`, result.error);
    }
  } catch (err) {
    console.warn('[Auth] Failed to enable auth user:', err);
  }
}

// ══════════════════════════════════════════════════════════════
// ── Employees ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEmployees(): Promise<HrEmployee[]> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select('*, department:hr_departments!hr_employees_department_id_fkey(*)')
    .order('full_name');
  if (error) throw error;
  return data || [];
}

export async function saveEmployee(
  emp: Omit<HrEmployee, 'id' | 'employee_code' | 'created_at' | 'updated_at' | 'department'>
): Promise<HrEmployee> {
  // Extract _role and _salaryAmounts before DB insert (these are not DB columns)
  const { _role, _salaryAmounts, ...dbFields } = emp as any;

  const { data, error } = await supabase
    .from('hr_employees')
    .insert(dbFields)
    .select('*, department:hr_departments!hr_employees_department_id_fkey(*)')
    .single();
  if (error) throw error;

  // Auto-create Supabase Auth account for fulltime/parttime employees using work_email
  if (data.work_email && (data.type === 'fulltime' || data.type === 'parttime')) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: data.work_email,
            full_name: data.full_name,
            employee_id: data.id,
            role: _role || 'member',
          }),
        }
      );
      const result = await res.json();
      if (result.success) {
        if (result.invited) {
          console.log(`[Auth] Invite email sent to ${data.work_email} (role: ${_role || 'member'})`);
        } else {
          console.log(`[Auth] Account already exists for ${data.work_email}, metadata updated`);
        }
      } else if (result.error) {
        console.warn(`[Auth] Failed to invite ${data.work_email}:`, result.error);
      }
    } catch (authErr) {
      console.warn('[Auth] Failed to auto-create auth account:', authErr);
    }
  }

  // Auto-create Supabase Auth account for freelancers using personal email
  if (data.email && data.type === 'freelancer') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email: data.email,
            full_name: data.full_name,
            employee_id: data.id,
            role: 'freelancer',
            worker_id: data.worker_id || undefined,
          }),
        }
      );
      const result = await res.json();
      if (result.success) {
        if (result.invited) {
          console.log(`[Auth] Freelancer invite sent to ${data.email}`);
        } else {
          console.log(`[Auth] Account already exists for ${data.email}, metadata updated`);
        }
      } else if (result.error) {
        console.warn(`[Auth] Failed to invite freelancer ${data.email}:`, result.error);
      }
    } catch (authErr) {
      console.warn('[Auth] Failed to auto-create freelancer auth account:', authErr);
    }
  }

  // Auto-sync to Workforce module (non-blocking)
  syncEmployeeToWorkforce(data).catch(err =>
    console.warn('[Workforce Sync] Auto-sync on create failed:', err)
  );

  return data;
}

export async function updateEmployee(id: string, updates: Partial<HrEmployee>): Promise<void> {
  const { department, ...clean } = updates as any;
  const { error } = await supabase
    .from('hr_employees')
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  // Auto-sync to Workforce module (non-blocking)
  supabase.from('hr_employees').select('*').eq('id', id).single().then(({ data }) => {
    if (data) syncEmployeeToWorkforce(data as HrEmployee).catch(err =>
      console.warn('[Workforce Sync] Auto-sync on update failed:', err)
    );
  });
}

/** Update the auth role for an existing employee via edge function */
export async function updateEmployeeRole(email: string, newRole: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'update_role', email, role: newRole }),
    }
  );
  const result = await res.json();
  if (result.error) throw new Error(result.error);
  return result.message || `Đã cập nhật role thành ${newRole}`;
}

/** Soft-delete: set status to 'terminated' and disable Auth account */
export async function deleteEmployee(id: string): Promise<void> {
  // Fetch employee first to get email
  const { data: emp } = await supabase
    .from('hr_employees')
    .select('work_email, email, type')
    .eq('id', id)
    .single();

  // Soft delete: set status to 'terminated'
  const { error } = await supabase
    .from('hr_employees')
    .update({ status: 'terminated', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  // Disable Auth user (ban, not delete)
  if (emp) {
    const authEmail = emp.type === 'freelancer' ? emp.email : emp.work_email;
    if (authEmail) {
      await disableAuthUser(authEmail);
    }
  }
}

/** Hard-delete: permanently remove employee record + delete auth account (ADMIN ONLY) */
export async function hardDeleteEmployee(id: string): Promise<void> {
  // Fetch employee first to get email for auth deletion
  const { data: emp } = await supabase
    .from('hr_employees')
    .select('work_email, email, type')
    .eq('id', id)
    .single();

  // Delete related data first (cascade won't handle all)
  await supabase.from('hr_contracts').delete().eq('employee_id', id);
  await supabase.from('hr_documents').delete().eq('employee_id', id);
  await supabase.from('hr_project_history').delete().eq('employee_id', id);
  await supabase.from('hr_employee_salary').delete().eq('employee_id', id);
  await supabase.from('hr_dependents').delete().eq('employee_id', id);

  // Delete the employee record
  const { error } = await supabase
    .from('hr_employees')
    .delete()
    .eq('id', id);
  if (error) throw error;

  // Delete Auth user permanently
  if (emp) {
    const authEmail = emp.type === 'freelancer' ? emp.email : emp.work_email;
    if (authEmail) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-auth`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ action: 'delete_user', email: authEmail }),
          }
        );
      } catch { /* ignore auth delete errors */ }
    }
  }
}

/** Reactivate a terminated employee */
export async function reactivateEmployee(id: string): Promise<void> {
  const { data: emp } = await supabase
    .from('hr_employees')
    .select('work_email, email, type')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('hr_employees')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;

  // Re-enable Auth user
  if (emp) {
    const authEmail = emp.type === 'freelancer' ? emp.email : emp.work_email;
    if (authEmail) {
      await enableAuthUser(authEmail);
    }
  }
}

/** Resend invite email to an employee's work_email */
export async function resendInvite(employee: { work_email: string; full_name: string; id: string }): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-employee-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'resend_invite', email: employee.work_email, full_name: employee.full_name, employee_id: employee.id }),
    }
  );
  const result = await res.json();
  if (result.error) throw new Error(result.error);
  return result.message || 'Đã gửi lại invite thành công';
}

/** Send password reset email to an employee's work_email */
export async function resetEmployeePassword(work_email: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-employee-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action: 'reset_password', email: work_email }),
    }
  );
  const result = await res.json();
  if (result.error) throw new Error(result.error);
  return result.message || 'Đã gửi email reset password';
}

// ══════════════════════════════════════════════════════════════
// ── Departments ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchDepartments(): Promise<HrDepartment[]> {
  const { data, error } = await supabase
    .from('hr_departments')
    .select('*')
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function saveDepartment(
  dept: Omit<HrDepartment, 'id' | 'created_at'>
): Promise<HrDepartment> {
  const { data, error } = await supabase
    .from('hr_departments')
    .insert(dept)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDepartment(id: string, updates: Partial<HrDepartment>): Promise<void> {
  const { error } = await supabase.from('hr_departments').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase.from('hr_departments').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Contracts ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchContracts(employeeId?: string): Promise<HrContract[]> {
  let q = supabase.from('hr_contracts').select('*').order('start_date', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveContract(
  contract: Omit<HrContract, 'id' | 'created_at'>
): Promise<HrContract> {
  const { data, error } = await supabase
    .from('hr_contracts')
    .insert(contract)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContract(id: string, updates: Partial<HrContract>): Promise<void> {
  const { error } = await supabase.from('hr_contracts').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from('hr_contracts').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Position History ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchPositionHistory(employeeId: string): Promise<HrPositionHistory[]> {
  const { data, error } = await supabase
    .from('hr_position_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('effective_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addPositionChange(
  change: Omit<HrPositionHistory, 'id' | 'created_at'>
): Promise<HrPositionHistory> {
  const { data, error } = await supabase
    .from('hr_position_history')
    .insert(change)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════════
// ── Evaluations ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEvaluations(employeeId?: string): Promise<HrEvaluation[]> {
  let q = supabase.from('hr_evaluations').select('*').order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveEvaluation(
  ev: Omit<HrEvaluation, 'id' | 'created_at'>
): Promise<HrEvaluation> {
  const { data, error } = await supabase
    .from('hr_evaluations')
    .insert(ev)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvaluation(id: string, updates: Partial<HrEvaluation>): Promise<void> {
  const { error } = await supabase.from('hr_evaluations').update(updates).eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Project History ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchProjectHistory(employeeId: string): Promise<HrProjectHistory[]> {
  const { data, error } = await supabase
    .from('hr_project_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProjectHistory(
  ph: Omit<HrProjectHistory, 'id' | 'created_at'>
): Promise<HrProjectHistory> {
  const { data, error } = await supabase.from('hr_project_history').insert(ph).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProjectHistory(id: string): Promise<void> {
  const { error } = await supabase.from('hr_project_history').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Documents ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchDocuments(employeeId?: string): Promise<HrDocument[]> {
  let q = supabase.from('hr_documents').select('*').order('created_at', { ascending: false });
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function saveDocument(
  doc: Omit<HrDocument, 'id' | 'created_at'>
): Promise<HrDocument> {
  const { data, error } = await supabase.from('hr_documents').insert(doc).select().single();
  if (error) throw error;
  return data;
}

export async function updateDocument(id: string, updates: Partial<HrDocument>): Promise<void> {
  const { error } = await supabase.from('hr_documents').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('hr_documents').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── R2 File Upload ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const R2_UPLOAD_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-expense-upload`;
const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_URL || '';
const MAX_FILE_SIZE_MB = 20;

export function toPublicUrl(url: string): string {
  if (!url || !R2_PUBLIC_BASE) return url;
  const r2Match = url.match(/https:\/\/[a-f0-9]+\.r2\.cloudflarestorage\.com\/(.+)/);
  if (r2Match) return `${R2_PUBLIC_BASE}/${r2Match[1]}`;
  return url;
}

export async function uploadFileToR2(file: File): Promise<{ url: string; fileName: string; fileSize: number }> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File quá lớn! Tối đa ${MAX_FILE_SIZE_MB}MB.`);
  }
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(R2_UPLOAD_URL, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return { url: data.url, fileName: file.name, fileSize: file.size };
}

// ══════════════════════════════════════════════════════════════
// ── Reminders ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchReminders(): Promise<(HrReminder & { employee?: HrEmployee })[]> {
  const { data, error } = await supabase
    .from('hr_reminders')
    .select('*, employee:hr_employees(id, full_name, employee_code, type, status)')
    .order('due_date');
  if (error) throw error;
  return data || [];
}

export async function dismissReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('hr_reminders')
    .update({ status: 'dismissed' })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Auto-generate reminders based on employee & contract data:
 * - Contract expiry (30 / 15 / 7 days)
 * - Birthday (7 days before)
 * - Probation end (7 days before)
 * - Work anniversary (7 days before)
 */
export async function generateReminders(): Promise<number> {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // Fetch all employees and contracts
  const [employees, contracts, existingReminders] = await Promise.all([
    fetchEmployees(),
    fetchContracts(),
    fetchReminders(),
  ]);

  const existing = new Set(
    existingReminders
      .filter(r => r.status !== 'dismissed')
      .map(r => `${r.employee_id}|${r.type}|${r.due_date}`)
  );

  const newReminders: Omit<HrReminder, 'id' | 'created_at'>[] = [];

  const addIfNew = (r: Omit<HrReminder, 'id' | 'created_at'>) => {
    const key = `${r.employee_id}|${r.type}|${r.due_date}`;
    if (!existing.has(key)) {
      newReminders.push(r);
      existing.add(key);
    }
  };

  for (const emp of employees) {
    if (emp.status !== 'active') continue;

    // Birthday — nếu ngày đã qua năm nay thì dùng năm sau
    if (emp.date_of_birth) {
      const dob = new Date(emp.date_of_birth);
      let bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (bday < today) bday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
      const diff = Math.ceil((bday.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 7) {
        addIfNew({
          employee_id: emp.id, type: 'birthday',
          title: `🎂 Sinh nhật ${emp.full_name}`,
          due_date: fmt(bday), status: 'pending', notes: '',
        });
      }
    }

    // Probation end
    if (emp.probation_end) {
      const probEnd = new Date(emp.probation_end);
      const diff = Math.ceil((probEnd.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 15) {
        addIfNew({
          employee_id: emp.id, type: 'probation_end',
          title: `📋 Hết thử việc: ${emp.full_name}`,
          due_date: emp.probation_end, status: 'pending', notes: '',
        });
      }

      // 6-month performance review (chỉ áp dụng sau khi hết thử việc → lên chính thức)
      if (probEnd < today) {
        // Tính số chu kỳ 6 tháng đã qua, lấy chu kỳ tiếp theo
        const probEndMs = probEnd.getTime();
        const sixMonthMs = 6 * 30.4375 * 86400000; // ~6 tháng tính theo ngày bình quân
        const elapsed = today.getTime() - probEndMs;
        const nextCycle = Math.ceil(elapsed / sixMonthMs) || 1;

        const nextReview = new Date(probEnd);
        nextReview.setMonth(nextReview.getMonth() + nextCycle * 6);

        const reviewDiff = Math.ceil((nextReview.getTime() - today.getTime()) / 86400000);
        if (reviewDiff >= 0 && reviewDiff <= 30) {
          addIfNew({
            employee_id: emp.id, type: 'performance_review',
            title: `🔄 Review ${nextCycle * 6} tháng: ${emp.full_name}`,
            due_date: fmt(nextReview), status: 'pending',
            notes: `Review định kỳ ${nextCycle * 6} tháng kể từ ngày lên chính thức`,
          });
        }
      }
    }

    // Work anniversary — nếu ngày đã qua năm nay thì dùng năm sau
    if (emp.start_date) {
      const start = new Date(emp.start_date);
      let anni = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      if (anni < today) anni = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
      const diff = Math.ceil((anni.getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff <= 7) {
        const years = anni.getFullYear() - start.getFullYear();
        if (years > 0) {
          addIfNew({
            employee_id: emp.id, type: 'anniversary',
            title: `🎉 Kỷ niệm ${years} năm: ${emp.full_name}`,
            due_date: fmt(anni), status: 'pending', notes: '',
          });
        }
      }
    }
  }

  // Contract expiry
  for (const c of contracts) {
    if (c.status !== 'active' || !c.end_date) continue;
    const end = new Date(c.end_date);
    const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    for (const threshold of [30, 15, 7]) {
      if (diff >= 0 && diff <= threshold) {
        addIfNew({
          employee_id: c.employee_id, type: 'contract_expiry',
          title: `⚠️ HĐ "${c.title}" hết hạn trong ${diff} ngày`,
          due_date: c.end_date, status: 'pending', notes: `Contract: ${c.contract_number || c.title}`,
        });
        break; // Only one reminder per contract
      }
    }
  }

  // Insert new reminders
  if (newReminders.length > 0) {
    const { error } = await supabase.from('hr_reminders').insert(newReminders);
    if (error) throw error;
  }

  return newReminders.length;
}

// ══════════════════════════════════════════════════════════════
// ── Salary Components ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchSalaryComponents(): Promise<HrSalaryComponent[]> {
  const { data, error } = await supabase
    .from('hr_salary_components')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function saveSalaryComponent(
  comp: Omit<HrSalaryComponent, 'id' | 'created_at'>
): Promise<HrSalaryComponent> {
  const { data, error } = await supabase
    .from('hr_salary_components')
    .insert(comp)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSalaryComponent(id: string, updates: Partial<HrSalaryComponent>): Promise<void> {
  const { error } = await supabase.from('hr_salary_components').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteSalaryComponent(id: string): Promise<void> {
  const { error } = await supabase.from('hr_salary_components').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Employee Salary ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEmployeeSalary(employeeId: string): Promise<HrEmployeeSalary[]> {
  const { data, error } = await supabase
    .from('hr_employee_salary')
    .select('*, component:hr_salary_components(*)')
    .eq('employee_id', employeeId)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function saveEmployeeSalary(
  es: Omit<HrEmployeeSalary, 'id' | 'created_at' | 'component'>
): Promise<HrEmployeeSalary> {
  const { data, error } = await supabase
    .from('hr_employee_salary')
    .insert(es)
    .select('*, component:hr_salary_components(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployeeSalary(id: string, updates: Partial<HrEmployeeSalary>): Promise<void> {
  const { component, ...clean } = updates as any;
  const { error } = await supabase.from('hr_employee_salary').update(clean).eq('id', id);
  if (error) throw error;
}

export async function deleteEmployeeSalary(id: string): Promise<void> {
  const { error } = await supabase.from('hr_employee_salary').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Dependents (Người phụ thuộc) ──────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchDependents(employeeId: string): Promise<HrDependent[]> {
  const { data, error } = await supabase
    .from('hr_dependents')
    .select('*, documents:hr_dependent_documents(*)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveDependent(dep: Omit<HrDependent, 'id' | 'created_at' | 'documents'>): Promise<HrDependent> {
  const { data, error } = await supabase
    .from('hr_dependents')
    .insert(dep)
    .select('*, documents:hr_dependent_documents(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateDependent(id: string, updates: Partial<HrDependent>): Promise<void> {
  const { documents, ...clean } = updates as any;
  const { error } = await supabase.from('hr_dependents').update(clean).eq('id', id);
  if (error) throw error;
}

export async function deleteDependent(id: string): Promise<void> {
  const { error } = await supabase.from('hr_dependents').delete().eq('id', id);
  if (error) throw error;
}

export async function saveDependentDocument(doc: Omit<HrDependentDocument, 'id' | 'created_at'>): Promise<HrDependentDocument> {
  const { data, error } = await supabase
    .from('hr_dependent_documents')
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDependentDocument(id: string): Promise<void> {
  const { error } = await supabase.from('hr_dependent_documents').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Workforce Sync (HR → wf_workers) ─────────────────────────
// ══════════════════════════════════════════════════════════════

/**
 * Sync a single HR employee to the Workforce module (wf_workers).
 * - If employee already has worker_id → update existing worker
 * - If no worker_id → find by email or create new worker, then link back
 * Returns the worker_id.
 */
export async function syncEmployeeToWorkforce(employee: HrEmployee): Promise<string | null> {
  try {
    const workerEmail = employee.type === 'freelancer'
      ? (employee.email || '')
      : (employee.work_email || employee.email || '');

    const workerType = employee.type === 'fulltime' ? 'inhouse' : 'freelancer';
    const isActive = employee.status === 'active';

    const workerData = {
      full_name: employee.full_name,
      email: workerEmail,
      phone: employee.phone || '',
      bank_name: employee.bank_name || '',
      bank_account: employee.bank_account || '',
      tax_code: employee.tax_code || '',
      type: workerType,
      is_active: isActive,
    };

    // Case 1: Already linked → update existing worker
    if (employee.worker_id) {
      const { error } = await supabase
        .from('wf_workers')
        .update(workerData)
        .eq('id', employee.worker_id);
      if (error) {
        console.warn('[Workforce Sync] Failed to update worker:', error);
        return employee.worker_id;
      }
      console.log(`[Workforce Sync] Updated worker for ${employee.full_name}`);
      return employee.worker_id;
    }

    // Case 2: Not linked → try to find existing worker by email
    if (workerEmail) {
      const { data: existing } = await supabase
        .from('wf_workers')
        .select('id')
        .eq('email', workerEmail)
        .limit(1)
        .single();

      if (existing) {
        // Link existing worker and update its data
        await supabase.from('wf_workers').update(workerData).eq('id', existing.id);
        await supabase.from('hr_employees')
          .update({ worker_id: existing.id })
          .eq('id', employee.id);
        console.log(`[Workforce Sync] Linked existing worker for ${employee.full_name}`);
        return existing.id;
      }
    }

    // Case 3: Create new worker
    const { data: newWorker, error: insertErr } = await supabase
      .from('wf_workers')
      .insert({
        ...workerData,
        notes: `Auto-synced from HR - ${employee.employee_code || ''}`,
      })
      .select('id')
      .single();
    if (insertErr) {
      console.warn('[Workforce Sync] Failed to create worker:', insertErr);
      return null;
    }

    // Link new worker_id back to HR employee
    await supabase.from('hr_employees')
      .update({ worker_id: newWorker.id })
      .eq('id', employee.id);

    console.log(`[Workforce Sync] Created & linked new worker for ${employee.full_name}`);
    return newWorker.id;
  } catch (err) {
    console.warn('[Workforce Sync] Error:', err);
    return null;
  }
}

/**
 * Batch sync: sync all HR employees that don't have a worker_id yet.
 * Returns the number of employees synced.
 */
export async function syncAllEmployeesToWorkforce(): Promise<number> {
  const { data: unlinked, error } = await supabase
    .from('hr_employees')
    .select('*')
    .is('worker_id', null);
  if (error) throw error;
  if (!unlinked?.length) return 0;

  let synced = 0;
  for (const emp of unlinked) {
    const workerId = await syncEmployeeToWorkforce(emp as HrEmployee);
    if (workerId) synced++;
  }
  return synced;
}

// ══════════════════════════════════════════════════════════════
// ── Equipment handover (biên bản bàn giao dụng cụ) ────────────
// ══════════════════════════════════════════════════════════════

export async function fetchEquipmentHandovers(employeeId: string): Promise<HrEquipmentHandover[]> {
  const { data, error } = await supabase
    .from('hr_equipment_handovers')
    .select('*, items:hr_equipment_handover_items(*)')
    .eq('employee_id', employeeId)
    .order('handover_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    file_url: row.file_url ?? '',
    items: [...(row.items || [])].sort(
      (a: HrEquipmentHandoverItem, b: HrEquipmentHandoverItem) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.name || '').localeCompare(b.name || ''),
    ),
  })) as HrEquipmentHandover[];
}

export async function saveEquipmentHandover(
  payload: Omit<HrEquipmentHandover, 'id' | 'created_at' | 'updated_at' | 'items'> & {
    items: Array<Omit<HrEquipmentHandoverItem, 'id' | 'handover_id'>>;
  },
): Promise<HrEquipmentHandover> {
  const { items, ...row } = payload;
  const { data: parent, error: e1 } = await supabase
    .from('hr_equipment_handovers')
    .insert(row)
    .select()
    .single();
  if (e1) throw e1;
  if (items?.length) {
    const ins = items.map((it, i) => ({
      handover_id: parent.id,
      name: it.name,
      description: it.description ?? '',
      quantity: it.quantity ?? 1,
      unit: it.unit ?? 'cái',
      serial_number: it.serial_number ?? '',
      condition_notes: it.condition_notes ?? '',
      sort_order: it.sort_order ?? i,
    }));
    const { error: e2 } = await supabase.from('hr_equipment_handover_items').insert(ins);
    if (e2) throw e2;
  }
  const full = await fetchEquipmentHandovers(payload.employee_id);
  const found = full.find(h => h.id === parent.id);
  if (!found) throw new Error('Không tải lại được biên bản');
  return found;
}

export async function updateEquipmentHandover(
  id: string,
  employeeId: string,
  updates: Partial<Omit<HrEquipmentHandover, 'id' | 'created_at' | 'items'>> & {
    items?: Array<Omit<HrEquipmentHandoverItem, 'id' | 'handover_id'>>;
  },
): Promise<HrEquipmentHandover> {
  const { items, ...rest } = updates;
  if (Object.keys(rest).length > 0) {
    const { error: e1 } = await supabase
      .from('hr_equipment_handovers')
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (e1) throw e1;
  }
  if (items !== undefined) {
    await supabase.from('hr_equipment_handover_items').delete().eq('handover_id', id);
    if (items.length) {
      const ins = items.map((it, i) => ({
        handover_id: id,
        name: it.name,
        description: it.description ?? '',
        quantity: it.quantity ?? 1,
        unit: it.unit ?? 'cái',
        serial_number: it.serial_number ?? '',
        condition_notes: it.condition_notes ?? '',
        sort_order: it.sort_order ?? i,
      }));
      const { error: e2 } = await supabase.from('hr_equipment_handover_items').insert(ins);
      if (e2) throw e2;
    }
  }
  const full = await fetchEquipmentHandovers(employeeId);
  const found = full.find(h => h.id === id);
  if (!found) throw new Error('Không tải lại được biên bản');
  return found;
}

export async function deleteEquipmentHandover(id: string): Promise<void> {
  const { error } = await supabase.from('hr_equipment_handovers').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════
// ── Parking registration ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export async function fetchParkingRegistrations(employeeId: string): Promise<HrParkingRegistration[]> {
  const { data, error } = await supabase
    .from('hr_parking_registrations')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as HrParkingRegistration[];
}

export async function saveParkingRegistration(
  row: Omit<HrParkingRegistration, 'id' | 'created_at' | 'updated_at'>,
): Promise<HrParkingRegistration> {
  const { data, error } = await supabase.from('hr_parking_registrations').insert(row).select().single();
  if (error) throw error;
  return data as HrParkingRegistration;
}

export async function updateParkingRegistration(
  id: string,
  updates: Partial<Omit<HrParkingRegistration, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('hr_parking_registrations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteParkingRegistration(id: string): Promise<void> {
  const { error } = await supabase.from('hr_parking_registrations').delete().eq('id', id);
  if (error) throw error;
}
