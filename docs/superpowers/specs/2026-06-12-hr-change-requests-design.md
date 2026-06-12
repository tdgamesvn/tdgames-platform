# HR Change Requests — Design Spec

_2026-06-12_

## Problem

HR personnel changes (probation end, salary, promotion, department transfer, termination) are applied directly in the EmployeeForm with no approval workflow. This means no audit trail of who requested/approved, no control over sensitive field changes, and errors are immediately live.

## Solution

A single `hr_change_requests` table with JSONB `changes` field. HR staff creates a request, CEO reviews and approves/rejects. On approval, the system auto-applies changes to `hr_employees`, `hr_employee_salary`, and `hr_position_history`.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approver model | CEO duyệt tất cả | Small company, single decision-maker |
| EmployeeForm behavior | Lock sensitive fields | official_date, salary, position, level, department only change via request |
| Notifications | Phase 1: none | Add email/in-app later |
| Schema approach | Single table + JSONB | Flexible, no migration for new types |
| Status flow | pending → approved/rejected | No draft (CEO reviews = simple flow) |
| Auto-apply location | Service function | Not DB trigger (easier to debug) |

## Database Schema

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
```

### request_type values

- `probation_end` — Kết thúc thử việc, lên chính thức
- `salary_change` — Điều chỉnh lương
- `promotion` — Thăng chức
- `department_transfer` — Chuyển phòng ban
- `termination` — Nghỉ việc

### status values

- `pending` — Chờ duyệt
- `approved` — Đã duyệt (auto-applied)
- `rejected` — Từ chối

### changes JSONB structure per type

**probation_end:**
```json
{
  "official_date": "2026-07-01",
  "salary_components": [
    { "component_id": "uuid", "name": "Lương cơ bản", "old_amount": 10000000, "new_amount": 12000000 },
    { "component_id": "uuid", "name": "Phụ cấp ăn trưa", "old_amount": 680000, "new_amount": 680000 }
  ]
}
```

**salary_change:**
```json
{
  "salary_components": [
    { "component_id": "uuid", "name": "Lương cơ bản", "old_amount": 12000000, "new_amount": 15000000 }
  ]
}
```

**promotion:**
```json
{
  "new_position": "Senior Developer",
  "new_level": "Senior",
  "salary_components": [
    { "component_id": "uuid", "name": "Lương cơ bản", "old_amount": 12000000, "new_amount": 18000000 }
  ]
}
```

**department_transfer:**
```json
{
  "new_department_id": "uuid",
  "new_department_name": "Engineering"
}
```

**termination:**
```json
{
  "termination_date": "2026-07-31",
  "termination_reason": "Nghỉ theo nguyện vọng cá nhân"
}
```

### current_snapshot structure

Captured at request creation time. Used for before/after comparison display.

```json
{
  "position": "Junior Developer",
  "level": "Junior",
  "department_id": "uuid",
  "department_name": "Game Development",
  "official_date": null,
  "salary_components": [
    { "component_id": "uuid", "name": "Lương cơ bản", "amount": 10000000 },
    { "component_id": "uuid", "name": "Phụ cấp ăn trưa", "amount": 680000 }
  ]
}
```

## TypeScript Interface

```typescript
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

## Service Layer — `changeRequestService.ts`

### CRUD

- `fetchChangeRequests(status?: string): Promise<HrChangeRequest[]>` — List all, optional filter by status. Joins `employee:hr_employees(*)`.
- `fetchChangeRequestsByEmployee(employeeId: string): Promise<HrChangeRequest[]>` — For employee detail view.
- `createChangeRequest(req: Omit<HrChangeRequest, 'id' | 'created_at' | 'employee'>): Promise<HrChangeRequest>` — Insert new pending request.
- `deleteChangeRequest(id: string): Promise<void>` — Only pending requests can be deleted.

### Approve / Reject

- `approveChangeRequest(id: string, approvedBy: string, note?: string): Promise<HrChangeRequest>` — Sets status to 'approved', sets approved_by/approved_at, then calls `applyChanges()`.
- `rejectChangeRequest(id: string, approvedBy: string, note?: string): Promise<HrChangeRequest>` — Sets status to 'rejected', sets approved_by/approved_at/approval_note.

### Auto-apply logic (private)

`applyChanges(request: HrChangeRequest): Promise<void>` — Called internally by `approveChangeRequest`. Switch on `request_type`:

| Type | Actions |
|------|---------|
| `probation_end` | 1. Update `hr_employees.official_date` 2. INSERT new `hr_employee_salary` records with `effective_from = effective_date` 3. INSERT `hr_position_history` (change_type='salary', old_value=old total, new_value=new total) |
| `salary_change` | 1. INSERT new `hr_employee_salary` records 2. INSERT `hr_position_history` (change_type='salary') |
| `promotion` | 1. Update `hr_employees.position` + `level` 2. Optional: INSERT salary records 3. INSERT `hr_position_history` (change_type='position') |
| `department_transfer` | 1. Update `hr_employees.department_id` 2. INSERT `hr_position_history` (change_type='department') |
| `termination` | 1. Update `hr_employees.status = 'inactive'` 2. INSERT `hr_position_history` (change_type='status', reason) |

## UI Components

### ChangeRequestTab.tsx

Main tab in HR app, accessed via navbar tab "Đề xuất".

**Layout:**
- Top bar: status filter pills (Tất cả / Chờ duyệt / Đã duyệt / Từ chối) + "Tạo đề xuất" button
- List of cards, each showing:
  - Left: Type badge icon + label, employee name, effective date
  - Right: Status badge (pending=orange, approved=green, rejected=red)
  - Click to expand: before/after comparison table + approve/reject buttons (if pending)

**Type badge mapping:**
- `probation_end`: 🎓 Lên chính thức
- `salary_change`: 💰 Điều chỉnh lương
- `promotion`: 🔺 Thăng chức
- `department_transfer`: 🔄 Chuyển phòng ban
- `termination`: ❌ Nghỉ việc

**Expanded detail:**
- Before/After comparison table showing changed fields
- For salary changes: table of all components with old → new amounts + total delta
- Reason text
- If pending: "Duyệt" (green) + "Từ chối" (red) buttons + optional note textarea
- If approved/rejected: show who approved/rejected + when + note

### ChangeRequestForm.tsx

Modal for creating a new request. Triggered from:
1. "Tạo đề xuất" button in ChangeRequestTab
2. "Tạo đề xuất →" link in EmployeeForm (when user clicks a locked field)

**Flow:**
1. Select employee (dropdown, pre-selected if opened from EmployeeForm)
2. Select request type (5 radio cards with icon + description)
3. Dynamic form based on type:
   - `probation_end`: date picker for official_date + salary component inputs (pre-filled with current amounts)
   - `salary_change`: salary component inputs (pre-filled current, editable new)
   - `promotion`: text input for position + level + optional salary inputs
   - `department_transfer`: department dropdown
   - `termination`: date picker + textarea for reason
4. Reason textarea (optional for all types)
5. Submit → creates pending request

### EmployeeForm.tsx changes

**Locked fields** (when `editingEmployee` is set, i.e. editing existing employee):
- `official_date` → readonly, show "🔒" icon
- Salary component inputs → readonly
- `position` → readonly
- `level` → readonly  
- `department_id` → readonly

**Banner above locked fields:**
```
🔒 Các trường lương, chức vụ, phòng ban chỉ thay đổi qua đơn đề xuất.
[Tạo đề xuất →]
```

Click "Tạo đề xuất →" opens ChangeRequestForm modal with employee pre-selected.

**Remove:** The old official_date salary modal (lines 1125-1230+). No longer needed — replaced by `probation_end` request type.

### HrApp.tsx + useHrState.ts

- Add `'changeRequests'` to activeTab union type
- Add tab in navbar: "Đề xuất" with pending count badge
- Add state: `changeRequests`, `fetchChangeRequests`, `handleApprove`, `handleReject`
- Wire ChangeRequestTab component

## File Map

| Action | File |
|--------|------|
| Create | `apps/hr/services/changeRequestService.ts` |
| Create | `apps/hr/components/ChangeRequestTab.tsx` |
| Create | `apps/hr/components/ChangeRequestForm.tsx` |
| Modify | `types.ts` — add HrChangeRequest interface |
| Modify | `apps/hr/hooks/useHrState.ts` — add state + handlers |
| Modify | `apps/hr/components/HrApp.tsx` — add tab |
| Modify | `apps/hr/components/EmployeeForm.tsx` — lock fields + remove old modal |
| Create | Supabase migration — hr_change_requests table |

## Out of Scope (Phase 2)

- Email/in-app notifications on approve/reject
- Employee self-service (request from Portal)
- Multi-level approval (Manager → CEO)
- Bulk requests
- Request templates
