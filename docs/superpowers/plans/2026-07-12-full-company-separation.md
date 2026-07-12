# Tách 2 sổ TD Games / TD Consulting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển workspace trên Navbar → toàn bộ dữ liệu mọi app (HR, chấm công, lương, kế toán, CRM, workforce, expense/invoice) tách theo sổ TD GAMES (sổ gốc) / TD CONSULTING (sổ phụ nội bộ).

**Architecture:** Cột `entity` trên bảng gốc mỗi module (default `'TD GAMES'` → backfill an toàn, không UPDATE/DROP). Bảng con kế thừa qua FK. UI filter qua `WorkspaceContext` + `matchesWorkspace()` sẵn có; tạo mới auto-tag entity = workspace hiện tại.

**Tech Stack:** React 19 + TS, Supabase (migration SQL), pattern entity đã có từ spec 2026-07-10.

**Spec:** `docs/superpowers/specs/2026-07-12-full-company-separation-design.md`

## Global Constraints

- Migration CHỈ `add column if not exists ... default 'TD GAMES'` — cấm UPDATE/DROP/đổi dữ liệu cũ.
- Convention cột: `entity text not null default 'TD GAMES' check (entity in ('TD GAMES','TD CONSULTING'))` (riêng `expense_expenses` đã có thêm `'Cá nhân'` — không đụng).
- E-invoice chỉ TD GAMES (đã guard sẵn — không đổi).
- Sau MỖI task: `npm run build` phải pass rồi mới commit.
- Trước khi apply migration lên Supabase prod: xác nhận backup daily gần nhất tồn tại (Supabase dashboard hoặc `mcp__supabase__list_branches`/advisors), apply bằng `mcp__supabase__apply_migration`.
- Không đụng: `ai_*`, `expense_categories`, `pay_payroll_formula_settings`, `hr_salary_components`, auth/roles, handbook content, system-monitor.
- UI: đọc `.agent/meta/STYLE_GUIDE.md` trước khi sửa component có markup mới.

## Pattern chuẩn (dùng xuyên suốt — "PATTERN-FILTER" / "PATTERN-TAG")

**PATTERN-FILTER (list component):** component đã có data từ service → filter client-side:

```tsx
import { useWorkspace, matchesWorkspace } from '../../../services/WorkspaceContext';
// trong component:
const { workspace } = useWorkspace();
const visible = rows.filter(r => matchesWorkspace(r.entity, workspace));
```

**PATTERN-FILTER-SV (service nhận entity):** nơi service tự aggregate (payroll generate, dashboard):

```ts
// service nhận thêm param entity: string, thêm vào query bảng gốc:
.eq('entity', entity)
```

**PATTERN-TAG (form tạo mới):** payload insert thêm entity từ context, không có field chọn tay:

```tsx
const { workspace } = useWorkspace();
// khi insert:
await supabase.from('<bảng gốc>').insert({ ...payload, entity: workspace });
```

**Lưu ý kỹ thuật:** `useWorkspace` chỉ gọi được trong React component/hook. Service thuần nhận `entity` qua tham số từ component gọi nó.

---

### Task 1: Migration + type

**Files:**
- Create: `supabase/migrations/20260712090000_entity_all_modules.sql`
- Modify: `types.ts` (thêm `entity?: string` vào các interface tương ứng)

**Interfaces:**
- Produces: cột `entity` trên 15 bảng gốc, giá trị `'TD GAMES' | 'TD CONSULTING'`, mọi record cũ = `'TD GAMES'`.

- [ ] **Step 1: Viết migration**

```sql
-- Tách 2 sổ: entity trên bảng gốc mỗi module. Bảng con kế thừa qua FK.
-- CHỈ add column + default — không UPDATE/DROP, dữ liệu cũ = TD GAMES (sổ gốc).
do $$
declare t text;
begin
  foreach t in array array[
    'hr_employees', 'hr_departments', 'hr_evaluation_cycles',
    'att_monthly_sheets', 'att_shifts',
    'pay_payroll_sheets',
    'crm_clients', 'crm_studios', 'crm_outreach_leads', 'crm_email_templates',
    'workforce_workers',
    'acc_savings', 'acc_loans', 'acc_fixed_assets', 'acc_advances', 'acc_bhxh_payments',
    'expense_recurring'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'alter table public.%I add column if not exists entity text not null default ''TD GAMES'' '
        || 'check (entity in (''TD GAMES'', ''TD CONSULTING''))', t);
    else
      raise notice 'skip: bảng % không tồn tại', t;
    end if;
  end loop;
end $$;
```

- [ ] **Step 2: Xác minh tên bảng thật** — chạy `mcp__supabase__list_tables` (hoặc grep `supabase/migrations/` local), đối chiếu 17 tên bảng trên. Bảng nào tên khác → sửa array. (`to_regclass` guard đã chống crash nhưng skip nhầm = mất filter.)

- [ ] **Step 3: Backup check rồi apply** — xác nhận backup daily gần nhất trên Supabase, rồi `mcp__supabase__apply_migration` với file trên. Expected: success, `raise notice` không skip bảng nào ngoài dự kiến.

- [ ] **Step 4: Thêm `entity?: string` vào types.ts** cho: Employee, Department, EvaluationCycle, AttendanceSheet/Shift, PayrollSheet, Client, Studio, OutreachLead, EmailTemplate, Worker, Saving, Loan, FixedAsset, Advance, BhxhPayment, RecurringExpense (tên interface thật xem trong `types.ts` — thêm cạnh các field hiện có, optional để không vỡ chỗ khác).

- [ ] **Step 5: `npm run build` pass → commit** `feat(db): entity column trên bảng gốc mọi module (tách 2 sổ)`

---

### Task 2: WorkspaceContext + Navbar

**Files:**
- Modify: `services/WorkspaceContext.tsx`
- Modify: `components/Navbar.tsx`

**Interfaces:**
- Produces: `type Workspace = 'TD GAMES' | 'TD CONSULTING'` (bỏ `'all'`); `matchesWorkspace(entity, w)` giữ nguyên signature nhưng bỏ nhánh `'all'`; switcher hiện cho admin/ke_toan/hr.

- [ ] **Step 1: Sửa WorkspaceContext.tsx**

```tsx
export type Workspace = 'TD GAMES' | 'TD CONSULTING';
// matchesWorkspace: bỏ nhánh if (w === 'all')
// useState init: saved === 'TD CONSULTING' ? saved : 'TD GAMES'  // 'all' cũ tự về TD GAMES
```

Lưu ý: `matchesWorkspace` hiện coi `'Cá nhân'` chỉ hiện ở `'all'` → giờ `'all'` không còn, quyết định: record `'Cá nhân'` (chỉ có ở expense) hiện ở **TD GAMES** (sổ gốc): `return (entity || 'TD GAMES') === w || (w === 'TD GAMES' && entity === 'Cá nhân');`

- [ ] **Step 2: Navbar** — tìm chỗ render switcher (grep `workspace` trong `components/Navbar.tsx`): bỏ option "Hợp nhất"/`'all'`; điều kiện hiển thị đổi thành `hasAnyRole(user, ['admin','ke_toan','hr'])`.

- [ ] **Step 3: Fix mọi chỗ compile lỗi do bỏ `'all'`** — `npm run build`, sửa từng lỗi TS (các file đang so sánh `workspace === 'all'`: Dashboard, ExpenseList, InvoiceEditor... → nhánh 'all' xoá, Dashboard xử lý riêng ở Task 8).

- [ ] **Step 4: Build pass → commit** `feat(workspace): switcher 2 sổ, bỏ Hợp nhất khỏi navbar, mở cho role hr`

---

### Task 3: HR (nhân viên, phòng ban, evaluation, change request)

**Files:**
- Modify: `apps/hr/services/hrService.ts`, `apps/hr/services/evaluationService.ts`
- Modify: `apps/hr/components/EmployeeForm.tsx`, form/tab phòng ban + evaluation cycle form (grep `from('hr_departments')`/`insert` trong `apps/hr/components/`)
- Modify: component list nhân viên/phòng ban (HRApp hoặc EmployeeList — nơi giữ mảng employees)

**Interfaces:**
- Consumes: `entity` trên `hr_employees`, `hr_departments`, `hr_evaluation_cycles` (Task 1); `Workspace` (Task 2).
- Produces: mọi list HR chỉ hiện record đúng workspace; tạo nhân viên/phòng ban/cycle mới auto-tag.

- [ ] **Step 1:** Select của employees/departments/cycles thêm `entity` vào cột select (nếu đang `select('*')` thì tự có).
- [ ] **Step 2:** PATTERN-FILTER tại component giữ list employees + departments + cycles.
- [ ] **Step 3:** PATTERN-TAG tại insert employee (EmployeeForm), insert department, insert evaluation cycle.
- [ ] **Step 4:** Change requests/contracts/salary/dependents… KHÔNG sửa (FK employee_id — list của chúng render theo employee đã filter). Kiểm tra 1 chỗ: màn Change Request list toàn cục (nếu load thẳng `hr_change_requests` không qua employee) → filter client-side bằng cách join sẵn employee entity: đổi select thành `select('*, hr_employees!inner(entity)')` + PATTERN-FILTER trên `r.hr_employees.entity`.
- [ ] **Step 5:** Verify nhanh localhost: ở TD CONSULTING danh sách nhân viên trống, tạo 1 nhân viên test → chuyển TD GAMES không thấy, chuyển lại thấy. Xoá nhân viên test.
- [ ] **Step 6:** Build pass → commit `feat(hr): tách nhân sự theo 2 sổ`

---

### Task 4: Attendance + Payroll

**Files:**
- Modify: `apps/payroll/services/payrollService.ts`, `apps/payroll/hooks/usePayrollState.ts`
- Modify: attendance service/component load `att_monthly_sheets`, `att_shifts`, `att_requests` (grep trong `apps/attendance/`)

**Interfaces:**
- Consumes: `entity` trên `att_monthly_sheets`, `att_shifts`, `pay_payroll_sheets`, `hr_employees`.
- Produces: `payrollService` các hàm generate/list sheet nhận thêm tham số `entity: string`; chấm công/lương tách sổ.

- [ ] **Step 1:** Attendance: PATTERN-FILTER cho list sheets + shifts; PATTERN-TAG khi tạo sheet/shift mới. `att_requests` filter qua employee entity (join `hr_employees!inner(entity)` như Task 3 Step 4).
- [ ] **Step 2:** `payrollService`: hàm tạo sheet + hàm query `hr_employees`/`att_monthly_sheets` thêm param `entity` → PATTERN-FILTER-SV (`.eq('entity', entity)`); insert `pay_payroll_sheets` kèm `entity`. Component/hook gọi service truyền `workspace` từ `useWorkspace()`.
- [ ] **Step 3:** List payroll sheets: PATTERN-FILTER.
- [ ] **Step 4:** Verify localhost: TD CONSULTING tạo bảng lương → chỉ tính nhân viên TD CONSULTING (danh sách trống nếu chưa có ai). TD GAMES bảng lương cũ nguyên vẹn.
- [ ] **Step 5:** Build pass → commit `feat(att,payroll): tách chấm công + bảng lương theo 2 sổ`

---

### Task 5: Accounting + Tax portal

**Files:**
- Modify: `apps/accounting/services/accountingService.ts`, `savingsService.ts`, `loansService.ts`
- Modify: `apps/tax-portal/services/taxPortalService.ts`
- Modify: form tạo mới savings/loans/fixed asset/advance/bhxh (grep `insert` trong `apps/accounting/components/`)

**Interfaces:**
- Consumes: `entity` trên `acc_savings/loans/fixed_assets/advances/bhxh_payments`; `finance_bank_accounts.entity` (đã có).
- Produces: app Kế toán đổi hoàn toàn theo workspace (điều sếp phàn nàn).

- [ ] **Step 1:** PATTERN-FILTER cho list savings, loans, fixed assets, advances, bhxh, bank statements (statements filter theo bank account entity — account list đã có entity).
- [ ] **Step 2:** PATTERN-TAG cho mọi form tạo mới 5 bảng acc_*.
- [ ] **Step 3:** Tax portal: các query acc_* thêm `.eq('entity', 'TD GAMES')` cứng — tax portal là giấy tờ thuế, chỉ sổ gốc.
- [ ] **Step 4:** Verify localhost: app Kế toán chuyển workspace → savings/loans/tài sản đổi theo; TD CONSULTING trống.
- [ ] **Step 5:** Build pass → commit `feat(accounting): tách sổ kế toán + tax portal chỉ sổ gốc`

---

### Task 6: CRM + Workforce

**Files:**
- Modify: `apps/crm/services/crmService.ts`, `studioService.ts`, `outreachService.ts`, `crmPaymentScheduleService.ts` (chỉ nơi query bảng gốc)
- Modify: `apps/crm/components/ClientForm.tsx` + form tạo studio/lead/template
- Modify: workforce service/list/form (grep `from('workforce_workers')` trong `apps/workforce/`)

**Interfaces:**
- Consumes: `entity` trên `crm_clients/studios/outreach_leads/email_templates`, `workforce_workers`.
- Produces: CRM + Workforce tách sổ; bảng con (contacts/deals/quotations/projects/tasks/settlements) kế thừa qua client/worker đã filter.

- [ ] **Step 1:** PATTERN-FILTER list clients, studios, outreach leads, email templates, workers.
- [ ] **Step 2:** PATTERN-TAG form tạo client, studio, lead, template, worker.
- [ ] **Step 3:** Deal pipeline/quotation/tài liệu/thanh toán: nếu màn nào load bảng con toàn cục không qua client → join `crm_clients!inner(entity)` + PATTERN-FILTER (kiểm tra Kanban deals và payment schedules). Workforce tasks/settlements tương tự qua `workforce_workers!inner(entity)`.
- [ ] **Step 4:** Verify localhost: CRM + Workforce đổi theo workspace.
- [ ] **Step 5:** Build pass → commit `feat(crm,workforce): tách khách hàng + freelancer theo 2 sổ`

---

### Task 7: Expense/Invoice — bỏ chọn tay, auto-tag

**Files:**
- Modify: `apps/expense/components/ExpenseForm.tsx`, `apps/invoice/components/InvoiceEditor.tsx`
- Modify: component/service load `expense_recurring`

**Interfaces:**
- Consumes: entity đã có trên expense/invoice/bank (spec 2026-07-10) + `expense_recurring` (Task 1).
- Produces: form không còn dropdown entity (trừ 'Cá nhân' ở expense); mặc định = workspace.

- [ ] **Step 1:** ExpenseForm: default entity = workspace hiện tại; giữ option 'Cá nhân' (đặc thù expense), bỏ chọn TD GAMES/TD CONSULTING chéo sổ (hoặc default theo workspace nếu bỏ hẳn gây phiền — quyết: **default theo workspace, dropdown chỉ còn [workspace hiện tại, 'Cá nhân']**).
- [ ] **Step 2:** InvoiceEditor: bỏ selector entity → `entity/billing_entity = workspace`; TD CONSULTING → auto-fill `TD_CONSULTING_STUDIO_INFO` (logic đã có, đổi nguồn từ dropdown sang context).
- [ ] **Step 3:** `expense_recurring`: PATTERN-FILTER + PATTERN-TAG.
- [ ] **Step 4:** Build pass → commit `feat(expense,invoice): entity auto theo workspace`

---

### Task 8: Dashboard hợp nhất + verify tổng

**Files:**
- Modify: `apps/dashboard/components/DashboardApp.tsx`, `apps/dashboard/services/dashboardService.ts`
- Modify: `supabase/functions/platform-data/index.ts`
- Modify: `scripts/verify-workspace.mjs` (mở rộng)

**Interfaces:**
- Consumes: mọi entity column; edge `platform-data` param `entity` (spec trước đã nhận — kiểm tra, thêm nếu chưa).
- Produces: Dashboard toggle 3 chế độ: TD GAMES / TD CONSULTING / Hợp nhất (mặc định = workspace hiện tại); các app khác không còn khái niệm hợp nhất.

- [ ] **Step 1:** DashboardApp: state cục bộ `view: Workspace | 'all'` (init = workspace), 3 nút toggle theo style badge/button STYLE_GUIDE; truyền xuống service + edge function (`'all'` = không filter).
- [ ] **Step 2:** `dashboardService`/`platform-data`: mọi query bảng gốc nhận entity, bỏ filter khi `'all'`.
- [ ] **Step 3:** Deploy edge function: `mcp__supabase__deploy_edge_function` cho `platform-data`.
- [ ] **Step 4:** Mở rộng `scripts/verify-workspace.mjs`: assert count theo entity cho hr_employees, acc_savings, crm_clients, pay_payroll_sheets. Chạy pass.
- [ ] **Step 5:** Verify E2E localhost (checklist spec §6): tạo dữ liệu test bên TD CONSULTING → không lộ sang TD GAMES; dashboard Hợp nhất = tổng; role member không thấy switcher. Xoá data test.
- [ ] **Step 6:** Build pass → commit `feat(dashboard): toggle hợp nhất riêng dashboard + verify script`

---

### Task 9: Chốt — review + memory

- [ ] **Step 1:** GitNexus `detect_changes({scope:'compare', base_ref:'main'})` — xác nhận phạm vi.
- [ ] **Step 2:** `/code-review` diff.
- [ ] **Step 3:** Cập nhật `.agent/meta/TASKS.md`, `LOG.md`, `DECISIONS.md` (quyết định: entity 2 sổ toàn hệ thống, TD CONSULTING = sổ phụ nội bộ) + cập nhật `CLAUDE.md` mục workspace.
- [ ] **Step 4:** Push (auto-deploy prod).
