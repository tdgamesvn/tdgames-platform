# HR Change Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an approval workflow for HR personnel changes (probation end, salary, promotion, department transfer, termination) so all sensitive changes require CEO approval before taking effect.

**Architecture:** Single `hr_change_requests` table with JSONB `changes` field. HR creates a pending request → CEO reviews → approves (auto-applies) or rejects. Sensitive fields in EmployeeForm are locked to read-only; changes only via the request system.

**Tech Stack:** TypeScript, React 19, Supabase (Postgres), existing HR module patterns

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | Supabase migration | `hr_change_requests` table + indexes |
| Modify | `types.ts` | Add `HrChangeRequest` interface + type aliases |
| Create | `apps/hr/services/changeRequestService.ts` | CRUD + approve/reject + auto-apply logic |
| Modify | `apps/hr/hooks/useHrState.ts` | Add changeRequests state + handlers + tab type |
| Modify | `apps/hr/components/HrApp.tsx` | Add "Đề xuất" tab routing + navbar |
| Create | `apps/hr/components/ChangeRequestTab.tsx` | List + filter + detail + approve/reject UI |
| Create | `apps/hr/components/ChangeRequestForm.tsx` | Modal to create new request |
| Modify | `apps/hr/components/EmployeeForm.tsx` | Lock sensitive fields + link to create request |

---

### Task 1: Database Migration

**Files:**
- Create: Supabase migration via MCP `apply_migration`

- [ ] **Step 1: Apply migration**

```sql
CREATE TABLE hr_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES hr_employees(id),
  request_type    text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  changes         jsonb NOT NULL,
  current_snapshot jsonb NOT NULL,
  effective_date  date NOT NULL,
  reason          text,
  requested_by    text,
  approved_by     text,
  approved_at     timestamptz,
  approval_note   text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_hr_change_requests_employee ON hr_change_requests(employee_id);
CREATE INDEX idx_hr_change_requests_status ON hr_change_requests(status);

COMMENT ON TABLE hr_change_requests IS 'Đơn đề xuất thay đổi nhân sự — pending → approved/rejected';
```

- [ ] **Step 2: Verify**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'hr_change_requests' ORDER BY ordinal_position;
```

Expected: 12 columns.

- [ ] **Step 3: Commit**

No file to commit for MCP migration, but note the migration was applied.

---

### Task 2: TypeScript Types

**Files:**
- Modify: `types.ts` (after `HrPositionHistory` interface, around line 544)

- [ ] **Step 1: Add types**

Insert after `HrPositionHistory` interface (line 544):

```typescript
// ── Change Requests (Đơn đề xuất nhân sự) ────────────────
export type HrChangeRequestType = 'probation_end' | 'salary_change' | 'promotion' | 'department_transfer' | 'termination';
export type HrChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface HrChangeRequest {
  id: string;
  employee_id: string;
  request_type: HrChangeRequestType;
  status: HrChangeRequestStatus;
  changes: Record<string, any>;
  current_snapshot: Record<string, any>;
  effective_date: string;
  reason?: string | null;
  requested_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  created_at: string;
  // joined
  employee?: HrEmployee;
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add types.ts && git commit -m "feat(hr): add HrChangeRequest type for approval workflow"
```

---

### Task 3: Service Layer — `changeRequestService.ts`

**Files:**
- Create: `apps/hr/services/changeRequestService.ts`

- [ ] **Step 1: Create the service file**

```typescript
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
    .eq('status', 'pending'); // Only pending can be deleted
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

  // Auto-apply changes
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

async function applyChanges(req: HrChangeRequest): Promise<void> {
  const c = req.changes;
  const empId = req.employee_id;
  const effDate = req.effective_date;

  switch (req.request_type) {
    case 'probation_end': {
      // 1. Update official_date
      await hrSvc.updateEmployee(empId, { official_date: c.official_date } as any);
      // 2. Insert new salary records
      if (c.salary_components?.length) {
        for (const sc of c.salary_components) {
          if (sc.new_amount > 0) {
            await hrSvc.saveEmployeeSalary({
              employee_id: empId,
              component_id: sc.component_id,
              amount: sc.new_amount,
              note: 'Lương chính thức (qua đề xuất)',
              effective_from: effDate,
              effective_to: null,
            });
          }
        }
        // 3. Position history
        const oldTotal = c.salary_components.reduce((s: number, x: any) => s + (x.old_amount || 0), 0);
        const newTotal = c.salary_components.reduce((s: number, x: any) => s + (x.new_amount || 0), 0);
        await hrSvc.addPositionChange({
          employee_id: empId,
          change_type: 'salary',
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
          if (sc.new_amount > 0) {
            await hrSvc.saveEmployeeSalary({
              employee_id: empId,
              component_id: sc.component_id,
              amount: sc.new_amount,
              note: 'Điều chỉnh lương (qua đề xuất)',
              effective_from: effDate,
              effective_to: null,
            });
          }
        }
        const oldTotal = c.salary_components.reduce((s: number, x: any) => s + (x.old_amount || 0), 0);
        const newTotal = c.salary_components.reduce((s: number, x: any) => s + (x.new_amount || 0), 0);
        await hrSvc.addPositionChange({
          employee_id: empId,
          change_type: 'salary',
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
      // Optional salary
      if (c.salary_components?.length) {
        for (const sc of c.salary_components) {
          if (sc.new_amount > 0) {
            await hrSvc.saveEmployeeSalary({
              employee_id: empId,
              component_id: sc.component_id,
              amount: sc.new_amount,
              note: 'Thăng chức (qua đề xuất)',
              effective_from: effDate,
              effective_to: null,
            });
          }
        }
      }
      const snap = req.current_snapshot;
      await hrSvc.addPositionChange({
        employee_id: empId,
        change_type: 'position',
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
        employee_id: empId,
        change_type: 'department',
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
        employee_id: empId,
        change_type: 'position' as any,
        old_value: 'active',
        new_value: 'inactive',
        effective_date: c.termination_date || effDate,
        reason: c.termination_reason || req.reason || 'Nghỉ việc (qua đề xuất)',
      });
      break;
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add apps/hr/services/changeRequestService.ts && git commit -m "feat(hr): add changeRequestService with CRUD + approve/reject + auto-apply"
```

---

### Task 4: Wire into useHrState + HrApp

**Files:**
- Modify: `apps/hr/hooks/useHrState.ts`
- Modify: `apps/hr/components/HrApp.tsx`

- [ ] **Step 1: Update useHrState — add tab type + state + handlers**

In `useHrState.ts`, update the HrTab type (line 6):

```typescript
export type HrTab = 'employees' | 'employeeForm' | 'employeeDetail' | 'departments' | 'reminders' | 'quickAdd' | 'evaluation' | 'changeRequests';
const VALID_TABS: HrTab[] = ['employees', 'employeeForm', 'employeeDetail', 'departments', 'reminders', 'quickAdd', 'evaluation', 'changeRequests'];
```

Add import at top (line 2):

```typescript
import { HrEmployee, HrDepartment, HrContract, HrEvaluation, HrReminder, HrChangeRequest } from '@/types';
```

After the `reminders` state (line 27), add:

```typescript
  const [changeRequests, setChangeRequests] = useState<HrChangeRequest[]>([]);
```

In `loadAll` function, add after the existing fetches:

```typescript
    import('../services/changeRequestService').then(m =>
      m.fetchChangeRequests().then(setChangeRequests).catch(() => {})
    );
```

After the existing handlers (before the `return` block), add:

```typescript
  // ── Change Request handlers ──
  const loadChangeRequests = useCallback(async () => {
    const { fetchChangeRequests: fetch } = await import('../services/changeRequestService');
    setChangeRequests(await fetch());
  }, []);

  const pendingChangeRequests = changeRequests.filter(r => r.status === 'pending');
```

Add to the return object (before closing brace):

```typescript
    changeRequests, pendingChangeRequests, loadChangeRequests,
```

- [ ] **Step 2: Update HrApp — add tab routing**

In `HrApp.tsx`, add import (after line 15):

```typescript
import ChangeRequestTab from './ChangeRequestTab';
```

Add to `TAB_MAP` (line 31):

```typescript
  changeRequests: 'requests',
```

Add to `TAB_LABELS` (line 38):

```typescript
  requests: 'Đề xuất',
```

Add to `REVERSE_TAB` (line 47):

```typescript
  requests: 'changeRequests',
```

Add `'requests'` to `accessibleTabs` array (line 55):

```typescript
  const accessibleTabs = ['history', 'activity', 'dashboard', 'tasks', 'requests'];
```

Add the tab content (after the evaluation block, before `</main>`, around line 171):

```tsx
        {state.activeTab === 'changeRequests' && (
          <ChangeRequestTab
            requests={state.changeRequests}
            employees={state.employees}
            departments={state.departments}
            currentUser={currentUser}
            onRefresh={state.loadChangeRequests}
            onToast={(msg, type) => state.setToast({ message: msg, type })}
          />
        )}
```

- [ ] **Step 3: Create stub ChangeRequestTab**

Create `apps/hr/components/ChangeRequestTab.tsx` with a minimal stub so the build passes:

```tsx
import React from 'react';
import { HrChangeRequest, HrEmployee, HrDepartment, AccountUser } from '@/types';

interface Props {
  requests: HrChangeRequest[];
  employees: HrEmployee[];
  departments: HrDepartment[];
  currentUser: AccountUser;
  onRefresh: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}

const ChangeRequestTab: React.FC<Props> = ({ requests }) => (
  <div className="text-white">
    <p className="text-neutral-medium text-sm">Đề xuất nhân sự — {requests.length} đơn</p>
  </div>
);

export default ChangeRequestTab;
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/hr/hooks/useHrState.ts apps/hr/components/HrApp.tsx apps/hr/components/ChangeRequestTab.tsx && git commit -m "feat(hr): wire change requests tab into HR app"
```

---

### Task 5: ChangeRequestTab — Full Implementation

**Files:**
- Modify: `apps/hr/components/ChangeRequestTab.tsx`

- [ ] **Step 1: Implement the full tab**

Replace the stub with the full implementation. The component must include:

1. **Status filter pills** at top: Tất cả / Chờ duyệt (count) / Đã duyệt / Từ chối
2. **"Tạo đề xuất"** button (opens ChangeRequestForm modal)
3. **Request cards list** — each card shows: type badge, employee name, effective date, status badge
4. **Click to expand** — shows before/after comparison, reason, approve/reject buttons
5. **Approve/Reject** — textarea for note, calls service, refreshes list

Follow the style guide: dark theme, `bg-surface` cards, `border-white/[0.08]`, `text-primary` for accent, status badges per guide patterns.

Type badge mapping:
- `probation_end`: `🎓 Lên chính thức` (orange)
- `salary_change`: `💰 Điều chỉnh lương` (emerald)
- `promotion`: `🔺 Thăng chức` (blue)
- `department_transfer`: `🔄 Chuyển phòng ban` (purple)
- `termination`: `❌ Nghỉ việc` (red)

Status badge mapping:
- `pending`: orange bg, "Chờ duyệt"
- `approved`: green bg, "Đã duyệt"
- `rejected`: red bg, "Từ chối"

The expanded detail section shows:
- For salary-related types (`probation_end`, `salary_change`, `promotion`): a table with columns [Khoản mục, Hiện tại, Đề xuất, Chênh lệch] listing each salary component
- For `probation_end`: also show official_date change
- For `promotion`: show position + level change
- For `department_transfer`: show department change
- For `termination`: show termination_date + reason
- Show `requested_by`, `created_at`
- If approved/rejected: show `approved_by`, `approved_at`, `approval_note`
- If pending: show approve (green) + reject (red) buttons + note textarea

Import and call `approveChangeRequest` / `rejectChangeRequest` from changeRequestService.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add apps/hr/components/ChangeRequestTab.tsx && git commit -m "feat(hr): implement ChangeRequestTab with list, detail, approve/reject"
```

---

### Task 6: ChangeRequestForm — Modal

**Files:**
- Create: `apps/hr/components/ChangeRequestForm.tsx`
- Modify: `apps/hr/components/ChangeRequestTab.tsx` (import + wire)

- [ ] **Step 1: Create the form modal**

`ChangeRequestForm.tsx` is a full-screen modal with these steps:

1. **Select employee** — dropdown of active employees (pre-selected if `initialEmployeeId` prop)
2. **Select request type** — 5 radio cards with icon + title + description
3. **Dynamic form** based on type:
   - `probation_end`: date input for `official_date` + salary component table (auto-loaded from `hr_employee_salary`, pre-filled with current amounts, new amounts editable)
   - `salary_change`: salary component table (same as above, no date)
   - `promotion`: text inputs for `new_position` + `new_level` + optional salary table
   - `department_transfer`: department dropdown
   - `termination`: date input + textarea for reason
4. **Reason textarea** (optional, all types)
5. **Submit button** — calls `createChangeRequest()`, captures `current_snapshot` from loaded employee data

The form needs to:
- Fetch salary components via `hrSvc.fetchSalaryComponents()`
- Fetch employee salary via `hrSvc.fetchEmployeeSalary(employeeId)` when employee is selected
- Build `current_snapshot` from the selected employee's current data
- Build `changes` JSONB per the spec's type-specific structures

Props:
```typescript
interface Props {
  employees: HrEmployee[];
  departments: HrDepartment[];
  initialEmployeeId?: string | null;
  initialType?: HrChangeRequestType | null;
  onSubmit: (req: HrChangeRequest) => void;
  onClose: () => void;
}
```

Follow style guide: modal with `bg-black/70` backdrop + `backdrop-blur-sm`, `bg-surface` panel, `border-white/[0.08]`, inputs with `bg-[#1a1a1a]` + `border-white/10` + `focus:border-orange-500/50`.

- [ ] **Step 2: Wire into ChangeRequestTab**

In `ChangeRequestTab.tsx`, add state for showing the form:

```typescript
const [showForm, setShowForm] = useState(false);
```

Import ChangeRequestForm and render it conditionally:

```tsx
{showForm && (
  <ChangeRequestForm
    employees={employees}
    departments={departments}
    onSubmit={(req) => { setShowForm(false); onRefresh(); onToast('Đã tạo đề xuất', 'success'); }}
    onClose={() => setShowForm(false)}
  />
)}
```

Wire the "Tạo đề xuất" button to `setShowForm(true)`.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add apps/hr/components/ChangeRequestForm.tsx apps/hr/components/ChangeRequestTab.tsx && git commit -m "feat(hr): add ChangeRequestForm modal with dynamic type-based forms"
```

---

### Task 7: Lock Sensitive Fields in EmployeeForm

**Files:**
- Modify: `apps/hr/components/EmployeeForm.tsx`

- [ ] **Step 1: Add ChangeRequestForm modal state + import**

At top of EmployeeForm, add:

```typescript
import ChangeRequestForm from './ChangeRequestForm';
```

Add state:

```typescript
const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
const [changeRequestType, setChangeRequestType] = useState<import('@/types').HrChangeRequestType | null>(null);
```

- [ ] **Step 2: Add locked fields banner**

In the form, before the sensitive fields section (around the `official_date`, `position`, `level`, `department_id`, salary inputs), add a banner when editing existing employee (`isEdit && editingEmployee`):

```tsx
{isEdit && (
  <div className="col-span-2 flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-500/20 mb-2" style={{ background: 'rgba(255,149,0,0.04)' }}>
    <span className="text-orange-400 text-sm">🔒</span>
    <span className="text-orange-300/80 text-xs font-semibold flex-1">
      Lương, chức vụ, phòng ban chỉ thay đổi qua đơn đề xuất.
    </span>
    <button type="button" onClick={() => setShowChangeRequestForm(true)}
      className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-orange-400 border border-orange-500/30 hover:bg-orange-500/10 transition-all">
      Tạo đề xuất →
    </button>
  </div>
)}
```

- [ ] **Step 3: Make sensitive fields readonly when editing**

For each sensitive field, when `isEdit` is true, add `readOnly` or `disabled` + visual indicator:

- `official_date` input: add `readOnly` + `className` with `opacity-60 cursor-not-allowed`
- `position` input: add `readOnly` + `opacity-60 cursor-not-allowed`
- `level` input: add `readOnly` + `opacity-60 cursor-not-allowed`
- `department_id` select: add `disabled` + `opacity-60 cursor-not-allowed`
- Salary component inputs: add `readOnly` + `opacity-60 cursor-not-allowed`

- [ ] **Step 4: Remove old official_date salary modal**

Delete the `showOfficialSalaryModal` state, `pendingOfficialDate`, `officialSalaryDraft`, `savingOfficialSalary` states, and the entire modal JSX block (the `{showOfficialSalaryModal && (...)}` block, approximately lines 1125-1230+).

Also remove the official_date change detection in the submit handler (the `if (newOfficialDate && newOfficialDate !== oldOfficialDate)` block) since this is now handled by change requests.

- [ ] **Step 5: Render ChangeRequestForm modal**

At the bottom of EmployeeForm's return, before the closing tags:

```tsx
{showChangeRequestForm && editingEmployee && (
  <ChangeRequestForm
    employees={[editingEmployee]}
    departments={departments}
    initialEmployeeId={editingEmployee.id}
    initialType={changeRequestType}
    onSubmit={() => { setShowChangeRequestForm(false); setChangeRequestType(null); }}
    onClose={() => { setShowChangeRequestForm(false); setChangeRequestType(null); }}
  />
)}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/hr/components/EmployeeForm.tsx && git commit -m "feat(hr): lock sensitive fields in EmployeeForm, link to change request flow"
```

---

### Task 8: Final Validation & Cleanup

- [ ] **Step 1: Full build check**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 2: Verify all features**

Checklist:
- [ ] Tab "Đề xuất" visible in HR navbar
- [ ] Can create each of the 5 request types
- [ ] Pending requests show approve/reject buttons
- [ ] Approve auto-applies (updates employee/salary/history)
- [ ] Reject records the note
- [ ] EmployeeForm locks sensitive fields when editing
- [ ] "Tạo đề xuất →" link opens the form
- [ ] Old salary modal removed
- [ ] Backward compatible — all existing HR features work

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "feat(hr): HR Change Request approval workflow

Complete approval system for personnel changes:
- 5 request types: probation_end, salary_change, promotion, department_transfer, termination
- Single hr_change_requests table with JSONB changes
- CEO approves → auto-apply to hr_employees, hr_employee_salary, hr_position_history
- New 'Đề xuất' tab in HR with list, filter, detail, approve/reject
- ChangeRequestForm modal with dynamic type-based forms
- EmployeeForm: sensitive fields locked, link to create request
- Old official_date salary modal removed"
```
