# Direct Salary Adjustment Modal

_2026-06-22 | HR Module_

## Problem

HR admin phải tạo Change Request → chờ approve → mới cập nhật lương. Với trường hợp admin tự quyết, flow approval không cần thiết và gây chậm trễ.

## Solution

Modal "Điều chỉnh lương" cho phép HR admin chỉnh lương trực tiếp, bypass hoàn toàn `hr_change_requests`. Thay đổi apply ngay lập tức.

## Components

### 1. Extract `SalaryEditor` → standalone file

- **From:** `ChangeRequestForm.tsx` (lines 43-119, inline sub-component)
- **To:** `apps/hr/components/SalaryEditor.tsx`
- Exports: `SalaryEditor` component + `SalaryRow` interface
- Both `ChangeRequestForm` and `SalaryAdjustModal` import from shared file

### 2. New `SalaryAdjustModal.tsx`

| Part | Detail |
|------|--------|
| Trigger | Button "💰 Điều chỉnh lương" on Info tab in EmployeeDetail.tsx, next to salary display |
| Modal | createPortal overlay (same pattern as ChangeRequestForm) |
| Content | SalaryEditor table + "Ngày hiệu lực" date input (default today) + "Lý do" optional textarea |
| Save | Calls `directSalaryAdjust()` |
| Feedback | Toast success/error via callback to parent |

### 3. Service function `directSalaryAdjust()`

**File:** `apps/hr/services/changeRequestService.ts`

```typescript
export async function directSalaryAdjust(
  empId: string,
  changedComponents: Array<{ component_id: string; name: string; old_amount: number; new_amount: number }>,
  effectiveDate: string,
  reason?: string,
): Promise<void> {
  // 1. rotateSalary() for each changed component
  // 2. Insert hr_position_history record (change_type: 'salary')
  // 3. Update employee.salary (quick-access total)
}
```

### 4. Trigger in `EmployeeDetail.tsx`

- Fulltime employees only (Info tab, salary section)
- Button: SM outline-orange style per style guide
- Opens `SalaryAdjustModal`
- On success: shows toast + refreshes employee data

## What This Does NOT Do

- Does NOT create any `hr_change_requests` record
- Does NOT require approval flow
- Only visible to HR admin (current user context)

## Data Flow

```
[Admin clicks button] → [Modal opens]
  → [Loads salary components via fetchSalaryComponents + fetchEmployeeSalary]
  → [Admin edits amounts, sets date, optional reason]
  → [Submit calls directSalaryAdjust()]
    → rotateSalary() per changed component
    → addPositionChange() with change_type='salary'
    → updateEmployee() with new total salary
  → [Modal closes, toast shows, parent refreshes]
```
