# Multi-book Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 workspace (Sổ TD Games / Sổ TD Consulting / Hợp nhất) cho admin + ke_toan, filter toàn bộ số liệu Invoice/Expense/Dashboard theo entity.

**Architecture:** Codebase đã có `invoice_invoices.billing_entity` và `finance_bank_accounts.entity` (giá trị `'TD GAMES' | 'TD CONSULTING' | 'Cá nhân'`). Chỉ cần: (1) thêm cột `entity` cùng convention vào `expense_expenses`, (2) `WorkspaceContext` global + switcher trên Navbar, (3) filter client-side theo workspace ở Expense list, Invoice history, Dashboard aggregation (các service này đã fetch toàn bộ rows rồi aggregate trong memory — filter trong memory là đủ, không đổi query shape).

**Tech Stack:** React 19 + TS, Supabase, Tailwind (token theo `.agent/meta/STYLE_GUIDE.md`).

## Global Constraints

- Giá trị entity: `'TD GAMES' | 'TD CONSULTING' | 'Cá nhân'` — TÁI DÙNG convention có sẵn của `billing_entity`, KHÔNG đặt `td_games`/`td_consulting` mới.
- Workspace type: `'TD GAMES' | 'TD CONSULTING' | 'all'`. Mặc định `'TD GAMES'`. Record `'Cá nhân'` chỉ hiện ở workspace `all`.
- Switcher chỉ render khi `hasAnyRole(currentUser, ['admin', 'ke_toan'])` (`utils/roleUtils.ts`).
- Repo không có test runner — check mỗi task = `npm run build` pass + verify thủ công cuối plan.
- KHÔNG commit `.agent/meta/`. Đọc `.agent/meta/STYLE_GUIDE.md` trước khi viết UI.
- Migration KHÔNG destructive: chỉ `ADD COLUMN ... DEFAULT`, không UPDATE/DELETE.

---

### Task 1: Migration + type — entity cho expense_expenses

**Files:**
- Create: `supabase/migrations/20260710090000_expense_entity.sql`
- Modify: `types.ts:98-118` (interface `ExpenseRecord`)

**Interfaces:**
- Produces: cột DB `expense_expenses.entity`, field `ExpenseRecord.entity?: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân'`

- [ ] **Step 1: Viết migration**

```sql
-- Thêm entity cho expense, cùng convention với invoice_invoices.billing_entity
-- và finance_bank_accounts.entity. Default 'TD GAMES' = backfill toàn bộ record cũ.
alter table public.expense_expenses
  add column if not exists entity text not null default 'TD GAMES'
  check (entity in ('TD GAMES', 'TD CONSULTING', 'Cá nhân'));

comment on column public.expense_expenses.entity is
  'Sổ sách: TD GAMES (sổ thực tế/thuế), TD CONSULTING (nội bộ), Cá nhân';
```

- [ ] **Step 2: Apply migration lên Supabase** (MCP `apply_migration` name `expense_entity`, hoặc `supabase db push`). Xác nhận: `select entity, count(*) from expense_expenses group by 1;` → toàn bộ = `TD GAMES`.

- [ ] **Step 3: Thêm field vào `ExpenseRecord` trong `types.ts`** — ngay dưới dòng `account_type?: 'company' | 'personal';` (dòng 117):

```typescript
  entity?: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân';
```

- [ ] **Step 4: `npm run build`** → pass.
- [ ] **Step 5: Commit** `feat(expense): add entity column for multi-book workspace`

---

### Task 2: WorkspaceContext + switcher trên Navbar

**Files:**
- Create: `services/WorkspaceContext.tsx`
- Modify: `App.tsx` (wrap provider quanh phần render sau khi đã đăng nhập)
- Modify: `components/Navbar.tsx` (thêm switcher, cạnh cụm phải — gần NotificationBell)

**Interfaces:**
- Produces: `useWorkspace(): { workspace: Workspace; setWorkspace: (w: Workspace) => void }` với `type Workspace = 'TD GAMES' | 'TD CONSULTING' | 'all'`; helper `matchesWorkspace(entity: string | null | undefined, w: Workspace): boolean`.

- [ ] **Step 1: Tạo `services/WorkspaceContext.tsx`** (pattern giống `services/ExchangeRateContext.tsx` sẵn có):

```tsx
import React, { createContext, useContext, useState } from 'react';

export type Workspace = 'TD GAMES' | 'TD CONSULTING' | 'all';

const KEY = 'workspace_entity';

// Record cũ/null coi là TD GAMES. 'Cá nhân' chỉ hiện ở workspace 'all'.
export function matchesWorkspace(entity: string | null | undefined, w: Workspace): boolean {
  if (w === 'all') return true;
  return (entity || 'TD GAMES') === w;
}

const WorkspaceContext = createContext<{
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
}>({ workspace: 'TD GAMES', setWorkspace: () => {} });

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWs] = useState<Workspace>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === 'TD CONSULTING' || saved === 'all' ? saved : 'TD GAMES';
  });
  const setWorkspace = (w: Workspace) => {
    localStorage.setItem(KEY, w);
    setWs(w);
  };
  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
```

- [ ] **Step 2: Wrap provider trong `App.tsx`** — tìm chỗ render `HomeScreen` (state đã đăng nhập đầy đủ), bọc `<WorkspaceProvider>...</WorkspaceProvider>` quanh nhánh đó (bọc cả cây sau-login là được, không cần chọn lọc từng màn).

- [ ] **Step 3: Thêm switcher vào `components/Navbar.tsx`** — trong cụm phải của Row 1 (cạnh `NotificationBell`). Navbar đã nhận prop `currentUser`; import `hasAnyRole` từ `@/utils/roleUtils` (file đã import `hasRole` sẵn) và `useWorkspace` từ `@/services/WorkspaceContext`. Vì Navbar là arrow-function-expression, chuyển thân sang block để gọi hook:

```tsx
const WS_LABEL: Record<string, string> = { 'TD GAMES': 'TD GAMES', 'TD CONSULTING': 'TD CONSULTING', all: 'HỢP NHẤT' };
const WS_DOT: Record<string, string> = { 'TD GAMES': 'bg-primary', 'TD CONSULTING': 'bg-blue-400', all: 'bg-neutral-400' };

// bên trong JSX cụm phải:
{hasAnyRole(currentUser, ['admin', 'ke_toan']) && (
  <div className="relative flex items-center gap-1.5 bg-surface border border-white/10 rounded-lg px-2 py-1">
    <span className={`w-2 h-2 rounded-full ${WS_DOT[workspace]}`} />
    <select
      value={workspace}
      onChange={e => setWorkspace(e.target.value as Workspace)}
      className="bg-transparent text-[10px] font-black uppercase tracking-wider text-white outline-none cursor-pointer appearance-none pr-4"
      title="Chọn sổ sách"
    >
      <option value="TD GAMES" className="bg-[#1a1a1a]">Sổ TD Games</option>
      <option value="TD CONSULTING" className="bg-[#1a1a1a]">Sổ TD Consulting</option>
      <option value="all" className="bg-[#1a1a1a]">Hợp nhất</option>
    </select>
  </div>
)}
```

Lưu ý theme: Navbar có biến `theme` — với `theme === 'light'` đổi `text-white` → `text-black`, `bg-surface` → `bg-gray-100 border-gray-200` (theo pattern các nút sẵn có trong file).

- [ ] **Step 4: `npm run build`** → pass. Chạy `npm run dev`, login admin: switcher hiện trên Navbar, đổi lựa chọn → reload trang vẫn giữ (localStorage).
- [ ] **Step 5: Commit** `feat: workspace switcher (TD Games / TD Consulting / Hợp nhất) on navbar`

---

### Task 3: Expense app — field entity + badge + filter theo workspace

**Files:**
- Modify: `apps/expense/components/ExpenseForm.tsx` (thêm selector entity, cạnh toggle `account_type` dòng ~217)
- Modify: `apps/expense/components/ExpenseList.tsx` (badge entity ~dòng 263 chỗ badge account_type; filter list)
- Modify: `apps/expense/hooks/useExpenseState.ts` hoặc `ExpenseApp.tsx` (điểm giữ danh sách expenses — filter bằng `matchesWorkspace` trước khi đưa xuống list/dashboard con)

**Interfaces:**
- Consumes: `useWorkspace()`, `matchesWorkspace()` (Task 2); `ExpenseRecord.entity` (Task 1).
- Produces: mọi view trong Expense app (list, ExpenseDashboard, ExpenseReports, CashFlowView) chỉ thấy record khớp workspace.

- [ ] **Step 1: ExpenseForm** — default form thêm `entity: 'TD GAMES'` (cạnh `account_type: 'company'` dòng 38). Thêm selector theo pattern toggle account_type sẵn có (2 nút bấm), đặt ngay dưới cụm account_type:

```tsx
{/* Entity — sổ sách */}
<div>
  <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-wider mb-1.5">Công ty</label>
  <div className="flex gap-2">
    {(['TD GAMES', 'TD CONSULTING'] as const).map(e => (
      <button key={e} type="button" onClick={() => update('entity', e)}
        className={`flex-1 px-3 py-2 rounded-lg border text-xs font-black uppercase transition-colors ${
          ((form as any).entity || 'TD GAMES') === e
            ? 'bg-primary/15 border-primary text-primary'
            : 'bg-[#1a1a1a] border-white/10 text-neutral-400'
        }`}>
        {e === 'TD GAMES' ? 'TD Games' : 'TD Consulting'}
      </button>
    ))}
  </div>
</div>
```

Khi mở form tạo mới mà workspace đang là `TD CONSULTING` → default `entity: 'TD CONSULTING'` (đọc `useWorkspace()` trong ExpenseForm, chỉ áp cho create, không áp cho edit).

- [ ] **Step 2: ExpenseList** — cạnh badge account_type (dòng ~263), thêm badge khi record là TD Consulting (TD Games không badge, đỡ nhiễu):

```tsx
{exp.entity === 'TD CONSULTING' && (
  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">TDC</span>
)}
```

- [ ] **Step 3: Filter theo workspace** — tại điểm giữ state danh sách (trong `useExpenseState.ts` nơi expose `expenses`, hoặc `ExpenseApp.tsx` nơi phân phối xuống tab con — chọn điểm CHUNG duy nhất mà mọi tab đều đi qua):

```tsx
const { workspace } = useWorkspace();
const visibleExpenses = useMemo(
  () => expenses.filter(e => matchesWorkspace(e.entity, workspace)),
  [expenses, workspace]
);
```

Đưa `visibleExpenses` xuống thay cho `expenses` ở list/dashboard/reports. `CashFlowView.tsx` tự query invoice riêng và đã có sẵn filter theo `billing_entity` stream — thêm điều kiện `matchesWorkspace(inv.billing_entity, workspace)` cho danh sách paidInvoices, và `matchesWorkspace` cho expenses mà nó nhận.

- [ ] **Step 4: `npm run build`** → pass. Dev: tạo 1 expense TD Consulting → đứng workspace TD Games không thấy, chuyển TD Consulting/Hợp nhất thấy; tổng số ExpenseDashboard đổi theo workspace.
- [ ] **Step 5: Commit** `feat(expense): entity field + workspace filtering`

---

### Task 4: Dashboard CEO — filter theo workspace

**Files:**
- Modify: `apps/dashboard/services/dashboardService.ts` (`fetchCeoDashboard` dòng 158; select thêm entity dòng 196-197)
- Modify: `apps/dashboard/components/DashboardApp.tsx` (truyền workspace + re-fetch khi đổi + dòng chú thích header)

**Interfaces:**
- Consumes: `Workspace`, `matchesWorkspace` (Task 2).
- Produces: `fetchCeoDashboard(targetMonth?, targetYear?, workspace?: Workspace)`.

- [ ] **Step 1: dashboardService** — thêm param `workspace: Workspace = 'all'` vào `fetchCeoDashboard`. Select thêm cột (dòng 196-197): invoice thêm `billing_entity`, expense thêm `entity`. Ngay sau khi nhận rows, filter TRƯỚC mọi aggregation:

```typescript
const invoices = (invoiceRows || []).filter(r => matchesWorkspace(r.billing_entity, workspace));
const expenses = (expenseRows || []).filter(r => matchesWorkspace(r.entity, workspace));
```

(Đặt tên biến theo code hiện có — mọi tính toán phía dưới dùng bản đã filter.)

- [ ] **Step 2: DashboardApp** — `const { workspace } = useWorkspace();` truyền vào `fetchCeoDashboard(...)`, thêm `workspace` vào dependency của effect load. Header thêm chú thích:

```tsx
<span className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">
  {workspace === 'all' ? 'Sổ hợp nhất' : workspace === 'TD GAMES' ? 'Sổ thực tế — TD Games' : 'Sổ TD Consulting'}
</span>
```

- [ ] **Step 3: `npm run build`** → pass. Dev: đổi workspace trên Navbar → KPI/P&L Dashboard nhảy số tương ứng.
- [ ] **Step 4: Commit** `feat(dashboard): filter CEO dashboard by workspace`

---

### Task 5: Invoice app — filter list theo workspace + guard e-invoice

**Files:**
- Modify: `apps/invoice/components/HistoryTab.tsx` (filter theo `billing_entity`)
- Modify: `apps/invoice/components/DashboardTab.tsx`, `ARAgingTab.tsx` (nếu nhận list invoices thì dùng bản đã filter — filter tại điểm chung trong `InvoiceApp.tsx`/`useInvoiceState.ts` nếu có)
- Modify: `apps/invoice/components/InvoiceEditor.tsx` (~dòng 97: nút e-invoice)

**Interfaces:**
- Consumes: `useWorkspace()`, `matchesWorkspace()`; `invoice.billing_entity` (đã có sẵn trong DB + editor).

- [ ] **Step 1: Filter list** — tại điểm giữ danh sách invoices chung (ưu tiên `useInvoiceState.ts` nếu list nằm đó, không thì `InvoiceApp.tsx`):

```tsx
const { workspace } = useWorkspace();
const visibleInvoices = useMemo(
  () => invoices.filter(inv => matchesWorkspace(inv.billing_entity, workspace)),
  [invoices, workspace]
);
```

Truyền `visibleInvoices` xuống HistoryTab / DashboardTab / ARAgingTab.

- [ ] **Step 2: Guard e-invoice** — trong `InvoiceEditor.tsx`, nút `onCreateEInvoice` (~dòng 97): disable khi `(invoice.billing_entity || 'TD GAMES') !== 'TD GAMES'` kèm `title="E-invoice chỉ khả dụng cho TD Games"`. (Editor đã có selector billing_entity ở dòng ~171 — không thêm gì.)

- [ ] **Step 3: `npm run build`** → pass. Dev: tạo invoice billing_entity = TD CONSULTING → chỉ hiện ở workspace TD Consulting/Hợp nhất; nút e-invoice disable trên invoice đó.
- [ ] **Step 4: Commit** `feat(invoice): workspace filtering + e-invoice guard for TD Consulting`

---

### Task 6: Data setup + verify tổng + memory

**Files:** không sửa code. `.agent/meta/TASKS.md`, `.agent/meta/LOG.md` (không commit).

- [ ] **Step 1: Thêm studio TD Consulting** qua UI Studio Manager sẵn có trong Invoice app: tên `TD CONSULTING COMPANY LIMITED`, MST `0109898663`, địa chỉ `Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam`, email để trống/tuỳ sếp. (Bank TD Consulting: sếp bổ sung sau qua Bank Manager sẵn có — không chặn.)
- [ ] **Step 2: Verify end-to-end** trên localhost:3000 (skill `/verify`): login admin đi hết luồng 3 workspace trên Expense + Invoice + Dashboard; login 1 user role `hr`/`member` → KHÔNG thấy switcher.
- [ ] **Step 3: `detect_changes({scope: "compare", base_ref: "main"})`** (GitNexus) — xác nhận phạm vi đúng các file trong plan.
- [ ] **Step 4: Cập nhật `.agent/meta/TASKS.md` + `LOG.md`** (entry ngày, work done + validation). Không commit `.agent/meta/`.

---

## Ghi chú cho người thực thi

- Record `'Cá nhân'` (đã tồn tại trên invoice/bank): chỉ hiện ở workspace **Hợp nhất** — chấp nhận theo thiết kế, `matchesWorkspace` xử lý sẵn.
- Backfill nghiệp vụ: sau deploy, kế toán tự tag lại các expense thuộc TD Consulting bằng form edit (Task 3 đã có field). Không script UPDATE hàng loạt.
- KHÔNG đụng: CRM, Workforce, HR, Payroll, Portal, edge function `platform-data` (dashboard app query trực tiếp Supabase từ `dashboardService.ts`, không qua edge function này).
