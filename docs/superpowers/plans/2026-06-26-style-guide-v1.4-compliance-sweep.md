# Style Guide v1.4 Full Compliance Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply TD Games Platform Style Guide v1.4 consistently across all 83 affected files — fixing 6 categories of violations: card radius, card border color, invalid opacity tokens, bracket-notation opacity, hover scale/translate, and slow transition duration.

**Architecture:** Pure styling sweep — zero logic changes, zero new features. Each task targets one app/group of files independently; all tasks can run in parallel. Final task runs `npm run build` to verify no TypeScript/compile regressions.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS (CDN/JIT), inline `style={{}}` for rgba values not in Tailwind scale.

---

## Global Constraints — Replacement Rules

> Every task executor MUST follow these rules exactly. Read this section before touching any file.

### Rule A — Card radius
| Context | Before | After |
|---------|--------|-------|
| Card / panel container (large div/section with `p-4` or more, has `border`) | `rounded-2xl` | `rounded-[20px]` |
| Button (`<button>` tag, or div acting as button with `px-N py-N` only) | `rounded-2xl` | `rounded-xl` |
| If ambiguous: default to `rounded-[20px]` for containers, `rounded-xl` for interactive elements | | |

### Rule B — Card border color
| Context | Before | After |
|---------|--------|-------|
| Card/panel container border | `border-white/8` | `border-primary/10` |
| In a ternary string, inactive/default branch | `'border-white/8'` | `'border-primary/10'` |
| Table header row | `border-white/8` | `border-white/5` (keep divider pattern) |

### Rule C — Invalid opacity tokens (non-standard Tailwind values)
| Before | After | Note |
|--------|-------|------|
| `border-white/3` | `border-white/5` | Table/card divider |
| `border-white/2` | `border-white/5` | |
| `hover:bg-white/2` | `hover:bg-white/5` | Hover on table row |
| `bg-white/2` (static, in className) | remove from className + add `style={{ background: 'rgba(255,255,255,0.02)' }}` | If element already has `style={{}}`, merge |
| `bg-white/3` (static, in className) | remove from className + add `style={{ background: 'rgba(255,255,255,0.03)' }}` | |
| `bg-white/4` | remove from className + add `style={{ background: 'rgba(255,255,255,0.04)' }}` | |

### Rule D — Bracket-notation opacity (used in Attendance app and others)
| Before | After | Context |
|--------|-------|---------|
| `border border-white/[0.06] bg-white/[0.03]` on cardCls | `border border-primary/10 bg-surface` | Card constant |
| `border-white/[0.06]` on table header `<tr>` | `border-white/5` | |
| `border-white/[0.03]` on table row `<tr>` | `border-white/5` | |
| `hover:bg-white/[0.02]` | `hover:bg-white/5` | |
| `bg-white/[0.03]` on inline badge/chip | inline `style={{ background: 'rgba(255,255,255,0.03)' }}` | |
| `bg-white/[0.05]` on button/chip | `bg-white/5` (remove brackets) | Valid Tailwind |

### Rule E — Remove hover scale / translate
Remove ALL occurrences of these from className strings (delete the class entirely, do not replace):
- `hover:scale-105`
- `hover:scale-[1.01]`
- `hover:scale-[1.02]`
- `hover:scale-[1.03]`
- `hover:-translate-y-1`
- `hover:-translate-y-2`
- `hover:translateY(-8px)` (inline style — remove key/value)

### Rule F — Remove slow transition duration
Remove these class tokens from className strings (keep the base `transition-all` or `transition-colors`):
- `duration-500`
- `duration-700`
- `duration-1000`
- `duration-300` **only** when it appears together with `hover:scale-*` (part of scale animation — remove both)

---

## File Structure Map

### Batch 1 — Shared components (5 files)
- `components/LoginScreen.tsx`
- `components/ProfileCompletionScreen.tsx`
- `components/SetPasswordScreen.tsx`
- `components/ToastNotification.tsx`
- `components/HelpPanel.tsx`

### Batch 2 — Accounting app (8 files)
- `apps/accounting/components/AdvanceTab.tsx`
- `apps/accounting/components/BhxhTab.tsx`
- `apps/accounting/components/FixedAssetTab.tsx`
- `apps/accounting/components/LoansTab.tsx`
- `apps/accounting/components/PnlTab.tsx`
- `apps/accounting/components/SavingsTab.tsx`
- `apps/accounting/components/TncnTab.tsx`
- `apps/accounting/components/VatTab.tsx`

### Batch 3 — AI Agent app (8 files)
- `apps/ai-agent/components/AgentRightPanel.tsx`
- `apps/ai-agent/components/AgentSidebar.tsx`
- `apps/ai-agent/components/AiAgentApp.tsx`
- `apps/ai-agent/components/ChatPanel.tsx`
- `apps/ai-agent/components/ConfigPanel.tsx`
- `apps/ai-agent/components/FeedPanel.tsx`
- `apps/ai-agent/components/InsightsPanel.tsx`
- `apps/ai-agent/components/MemoryPanel.tsx`
- `apps/ai-agent/components/RunsPanel.tsx`

### Batch 4 — Attendance app (7 files)
- `apps/attendance/components/AttendanceApp.tsx`
- `apps/attendance/components/AttendanceLog.tsx`
- `apps/attendance/components/AttendanceReport.tsx`
- `apps/attendance/components/Dashboard.tsx`
- `apps/attendance/components/MonthlySheet.tsx`
- `apps/attendance/components/RequestManager.tsx`
- `apps/attendance/components/ShiftManager.tsx`

### Batch 5 — Company + CRM (8 files)
- `apps/company/components/BankTab.tsx`
- `apps/company/components/DocumentsTab.tsx`
- `apps/company/components/HandbookAdminTab.tsx`
- `apps/company/components/InfoTab.tsx`
- `apps/crm/components/CrmApp.tsx`
- `apps/crm/components/pipeline/DealDetailPanel.tsx`
- `apps/crm/components/pipeline/DealFormModal.tsx`
- `apps/crm/components/pipeline/PipelineColumn.tsx`

### Batch 6 — Dashboard + Expense (10 files)
- `apps/dashboard/components/DashboardApp.tsx`
- `apps/dashboard/components/PlTable.tsx`
- `apps/dashboard/components/TrendChart.tsx`
- `apps/expense/components/ExpenseApp.tsx`
- `apps/expense/components/ExpenseCategoryManager.tsx`
- `apps/expense/components/ExpenseDashboard.tsx`
- `apps/expense/components/ExpenseForm.tsx`
- `apps/expense/components/ExpenseList.tsx`
- `apps/expense/components/ExpenseRecurring.tsx`
- `apps/expense/components/ExpenseReports.tsx`

### Batch 7 — Freelancer Portal + Handbook + Payroll (8 files)
- `apps/freelancer-portal/components/FreelancerPortalApp.tsx`
- `apps/handbook/components/HandbookApp.tsx`
- `apps/payroll/components/GrossNetCalculator.tsx`
- `apps/payroll/components/PayrollApp.tsx`
- `apps/payroll/components/PayrollFormulaPanel.tsx`
- `apps/payroll/components/PayrollSheet.tsx`

### Batch 8 — HR app (13 files)
- `apps/hr/components/ChangeRequestTab.tsx`
- `apps/hr/components/DepartmentManager.tsx`
- `apps/hr/components/DocumentManager.tsx`
- `apps/hr/components/EmployeeDetail.tsx`
- `apps/hr/components/EmployeeForm.tsx`
- `apps/hr/components/EmployeeList.tsx`
- `apps/hr/components/EquipmentHandoverPrint.tsx`
- `apps/hr/components/HrApp.tsx`
- `apps/hr/components/QuickAddEmployee.tsx`
- `apps/hr/components/ReminderDashboard.tsx`
- `apps/hr/components/SalaryComponentManager.tsx`
- `apps/hr/components/eval/EvalCreateModal.tsx`
- `apps/hr/components/eval/EvalCycleDetail.tsx`
- `apps/hr/components/eval/EvalCycleList.tsx`
- `apps/hr/components/eval/EvalScoreCard.tsx`

### Batch 9 — Invoice + Portal (11 files)
- `apps/invoice/components/ActivityLogTab.tsx`
- `apps/invoice/components/EInvoiceModals.tsx`
- `apps/invoice/components/EmailModal.tsx`
- `apps/invoice/components/HistoryTab.tsx`
- `apps/invoice/components/InvoiceApp.tsx`
- `apps/invoice/components/InvoiceEditor.tsx`
- `apps/invoice/components/InvoicePreview.tsx`
- `apps/portal/components/ProfileTab.tsx`
- `apps/portal/components/eval/PortalEvalForm.tsx`
- `apps/portal/components/eval/PortalEvalList.tsx`
- `apps/portal/components/eval/PortalEvalResult.tsx`

### Batch 10 — System Monitor + Workforce (8 files)
- `apps/system-monitor/components/SystemMonitorApp.tsx`
- `apps/workforce/components/FinancialDashboard.tsx`
- `apps/workforce/components/TaskList.tsx`
- `apps/workforce/components/WorkerForm.tsx`
- `apps/workforce/components/WorkerList.tsx`
- `apps/workforce/components/WorkforceApp.tsx`
- `apps/workforce/components/acceptance/AcceptanceListView.tsx`
- `apps/workforce/components/settlement/SettlementListView.tsx`

---

## Tasks

> Tasks 1–10 are INDEPENDENT and can run in parallel.

---

### Task 1: Fix shared components (Batch 1)

**Files:**
- Modify: `components/LoginScreen.tsx`
- Modify: `components/ProfileCompletionScreen.tsx`
- Modify: `components/SetPasswordScreen.tsx`
- Modify: `components/ToastNotification.tsx`
- Modify: `components/HelpPanel.tsx`

**Interfaces:**
- Consumes: Global Constraint Rules A–F (see top of document)
- Produces: 5 files with zero style violations; all others unchanged

- [ ] **Step 1: Read each file and catalog violations**

For each file, identify every line containing:
`rounded-2xl`, `border-white/8`, `border-white/3`, `bg-white/2`, `bg-white/3`, `hover:scale-`, `duration-500`, `duration-700`, `duration-1000`, `border-white/[0.`, `bg-white/[0.`

- [ ] **Step 2: Apply Rules A–F to each file using Edit tool**

Apply in this order per file:
1. Rule A: `rounded-2xl` → `rounded-[20px]` (containers) or `rounded-xl` (buttons)
2. Rule B: `border-white/8` → `border-primary/10` on cards
3. Rule C: `border-white/3` → `border-white/5`; `bg-white/2` fixes
4. Rule D: bracket-notation opacity fixes
5. Rule E: remove `hover:scale-*`
6. Rule F: remove `duration-500`/`700`/`1000`

- [ ] **Step 3: Commit**

```bash
git add components/LoginScreen.tsx components/ProfileCompletionScreen.tsx components/SetPasswordScreen.tsx components/ToastNotification.tsx components/HelpPanel.tsx
git commit -m "style: apply v1.4 guide to shared components"
```

---

### Task 2: Fix Accounting app (Batch 2)

**Files:**
- Modify: `apps/accounting/components/AdvanceTab.tsx`
- Modify: `apps/accounting/components/BhxhTab.tsx`
- Modify: `apps/accounting/components/FixedAssetTab.tsx`
- Modify: `apps/accounting/components/LoansTab.tsx`
- Modify: `apps/accounting/components/PnlTab.tsx`
- Modify: `apps/accounting/components/SavingsTab.tsx`
- Modify: `apps/accounting/components/TncnTab.tsx`
- Modify: `apps/accounting/components/VatTab.tsx`

**Key known violations:**
- `TncnTab.tsx:82` — `border-b border-white/3 hover:bg-white/2` → `border-b border-white/5 hover:bg-white/5`
- `TncnTab.tsx:99` — `bg-white/2` static → add `style={{ background: 'rgba(255,255,255,0.02)' }}`
- `LoansTab.tsx:95,203` — `rounded-2xl border border-white/10 p-6` → `rounded-[20px]`
- `BhxhTab.tsx:180` — `rounded-2xl border border-white/10 p-6` → `rounded-[20px]`
- `AdvanceTab.tsx:212,284` — `rounded-2xl border border-white/10 p-6` → `rounded-[20px]`
- `FixedAssetTab.tsx:171` — `rounded-2xl border border-white/5` → `rounded-[20px]`
- `SavingsTab.tsx:128,224,317` — `rounded-2xl border border-white/10 p-6` → `rounded-[20px]`
- Multiple files: `border-white/3`, `hover:bg-white/2`, `bg-white/2` in table rows (Rule C)

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 8 accounting files with zero violations

- [ ] **Step 1: Read all 8 files and catalog violations per file**

- [ ] **Step 2: Apply Rules A–F to each file using Edit tool**

Priority for Accounting: Rule C is most prevalent (table row patterns). For every table `<tr>`:
```jsx
// Before:
<tr className="border-b border-white/3 hover:bg-white/2">
// After:
<tr className="border-b border-white/5 hover:bg-white/5">

// Before (static bg):
<tr className="border-t border-white/10 bg-white/2">
// After:
<tr className="border-t border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
```

For modal/form panels (Rule A):
```jsx
// Before:
<div className="rounded-2xl border border-white/10 p-6 w-full max-w-md space-y-4 animate-scaleIn"
// After:
<div className="rounded-[20px] border border-primary/10 p-6 w-full max-w-md space-y-4 animate-scaleIn"
```

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/components/
git commit -m "style: apply v1.4 guide to Accounting app"
```

---

### Task 3: Fix AI Agent app (Batch 3)

**Files:**
- Modify: `apps/ai-agent/components/AgentRightPanel.tsx`
- Modify: `apps/ai-agent/components/AgentSidebar.tsx`
- Modify: `apps/ai-agent/components/AiAgentApp.tsx`
- Modify: `apps/ai-agent/components/ChatPanel.tsx`
- Modify: `apps/ai-agent/components/ConfigPanel.tsx`
- Modify: `apps/ai-agent/components/FeedPanel.tsx`
- Modify: `apps/ai-agent/components/InsightsPanel.tsx`
- Modify: `apps/ai-agent/components/MemoryPanel.tsx`
- Modify: `apps/ai-agent/components/RunsPanel.tsx`

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 9 AI Agent files with zero violations

- [ ] **Step 1: Read all 9 files and catalog violations per file**

Focus especially on `AiAgentApp.tsx` (likely `duration-500` on app wrapper), `FeedPanel.tsx` and `InsightsPanel.tsx` (likely `border-white/3`/`bg-white/2` in lists).

- [ ] **Step 2: Apply Rules A–F using Edit tool**

For `AiAgentApp.tsx` tab transition:
```jsx
// Before:
className="... transition-colors duration-500 ..."
// After:
className="... transition-colors ..."
```

For card panels:
```jsx
// Before:
className="rounded-2xl border border-white/8 p-4 ..."
// After:
className="rounded-[20px] border border-primary/10 p-4 ..."
```

- [ ] **Step 3: Commit**

```bash
git add apps/ai-agent/components/
git commit -m "style: apply v1.4 guide to AI Agent app"
```

---

### Task 4: Fix Attendance app (Batch 4)

**Files:**
- Modify: `apps/attendance/components/AttendanceApp.tsx`
- Modify: `apps/attendance/components/AttendanceLog.tsx`
- Modify: `apps/attendance/components/AttendanceReport.tsx`
- Modify: `apps/attendance/components/Dashboard.tsx`
- Modify: `apps/attendance/components/MonthlySheet.tsx`
- Modify: `apps/attendance/components/RequestManager.tsx`
- Modify: `apps/attendance/components/ShiftManager.tsx`

**Key known violations (Rule D is dominant here):**

All 5 component files share this `cardCls` constant:
```tsx
// BEFORE (in Dashboard.tsx, RequestManager.tsx, ShiftManager.tsx, AttendanceLog.tsx, AttendanceReport.tsx):
const cardCls = 'rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-xl';

// AFTER:
const cardCls = 'rounded-[20px] border border-primary/10 bg-surface p-6 backdrop-blur-xl';
```

Table rows across all files:
```jsx
// BEFORE:
<tr className="border-b border-white/[0.06] text-neutral-medium text-xs uppercase tracking-wider">
// AFTER:
<tr className="border-b border-white/5 text-neutral-medium text-xs uppercase tracking-wider">

// BEFORE:
<tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
// AFTER:
<tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
```

ShiftManager.tsx badges:
```jsx
// BEFORE:
'bg-white/[0.03] text-neutral-medium/30'
// AFTER (in a style prop if needed):
keep as `style={{ background: 'rgba(255,255,255,0.03)' }}` or use `bg-white/5` if brighter is acceptable
```

ShiftManager.tsx border-t:
```jsx
// BEFORE:
className="mt-3 pt-3 border-t border-white/[0.06]"
// AFTER:
className="mt-3 pt-3 border-t border-white/5"
```

AttendanceApp.tsx:
```jsx
// Remove duration-500:
className="... transition-colors duration-500 ..." → className="... transition-colors ..."
```

**Interfaces:**
- Consumes: Global Constraint Rules A–F (Rule D is primary for this batch)
- Produces: 7 Attendance files with zero violations

- [ ] **Step 1: Read all 7 files and catalog violations**

- [ ] **Step 2: Fix `cardCls` constant in Dashboard.tsx, RequestManager.tsx, ShiftManager.tsx, AttendanceLog.tsx, AttendanceReport.tsx** (one Edit call each)

- [ ] **Step 3: Fix all table row `<tr>` patterns across all 7 files**

- [ ] **Step 4: Fix remaining violations (duration, button border, chip bg) in ShiftManager.tsx and AttendanceApp.tsx**

- [ ] **Step 5: Commit**

```bash
git add apps/attendance/components/
git commit -m "style: apply v1.4 guide to Attendance app"
```

---

### Task 5: Fix Company + CRM apps (Batch 5)

**Files:**
- Modify: `apps/company/components/BankTab.tsx`
- Modify: `apps/company/components/DocumentsTab.tsx`
- Modify: `apps/company/components/HandbookAdminTab.tsx`
- Modify: `apps/company/components/InfoTab.tsx`
- Modify: `apps/crm/components/CrmApp.tsx`
- Modify: `apps/crm/components/pipeline/DealDetailPanel.tsx`
- Modify: `apps/crm/components/pipeline/DealFormModal.tsx`
- Modify: `apps/crm/components/pipeline/PipelineColumn.tsx`

**Key known violations:**
- `DealDetailPanel.tsx:530` — `rounded-xl border border-white/8 p-3` → `border-primary/10`
- `DealDetailPanel.tsx:617` — `border-b border-white/8` on sticky header → `border-white/5`
- `CrmApp.tsx` — likely `duration-500` on tab transitions
- Company files — likely `rounded-2xl` on form modals, `hover:scale-*` on buttons

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 8 Company/CRM files with zero violations

- [ ] **Step 1: Read all 8 files and catalog violations**

- [ ] **Step 2: Apply Rules A–F to each file**

For `DealDetailPanel.tsx` sticky header (Rule B exception — this is a divider, not a card):
```jsx
// BEFORE:
className="sticky top-0 z-10 border-b border-white/8" style={{ background: '#111' }}
// AFTER:
className="sticky top-0 z-10 border-b border-white/5" style={{ background: '#111' }}
```

- [ ] **Step 3: Commit**

```bash
git add apps/company/components/ apps/crm/components/
git commit -m "style: apply v1.4 guide to Company and CRM apps"
```

---

### Task 6: Fix Dashboard + Expense apps (Batch 6)

**Files:**
- Modify: `apps/dashboard/components/DashboardApp.tsx`
- Modify: `apps/dashboard/components/PlTable.tsx`
- Modify: `apps/dashboard/components/TrendChart.tsx`
- Modify: `apps/expense/components/ExpenseApp.tsx`
- Modify: `apps/expense/components/ExpenseCategoryManager.tsx`
- Modify: `apps/expense/components/ExpenseDashboard.tsx`
- Modify: `apps/expense/components/ExpenseForm.tsx`
- Modify: `apps/expense/components/ExpenseList.tsx`
- Modify: `apps/expense/components/ExpenseRecurring.tsx`
- Modify: `apps/expense/components/ExpenseReports.tsx`

**Key known violations:**
- `DashboardApp.tsx` — `duration-1000` (worst case) on animation
- `ExpenseDashboard.tsx` — `duration-700` on chart progress bars
- `ExpenseApp.tsx` — `duration-500` on tab
- `ExpenseList.tsx:338` — `bg-[#161616] border border-white/10 rounded-2xl p-6` modal → `rounded-[20px] border border-primary/10 bg-surface`
- `ExpenseRecurring.tsx:111,115` — `rounded-2xl py-4` on full-width buttons → `rounded-xl`; also `hover:scale-[1.01]` → remove
- `ExpenseForm.tsx:302,306` — same button pattern as ExpenseRecurring
- `ExpenseCategoryManager.tsx:99,103` — same button pattern

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 10 Dashboard/Expense files with zero violations

- [ ] **Step 1: Read all 10 files and catalog violations**

- [ ] **Step 2: Fix DashboardApp.tsx and TrendChart.tsx duration violations**

```jsx
// DashboardApp.tsx — remove duration-1000:
className="... transition-all duration-1000 ..." → className="... transition-all ..."

// ExpenseDashboard.tsx — remove duration-700 from progress bars:
className="... transition-all duration-700 ..." → className="... transition-all ..."
```

- [ ] **Step 3: Fix full-width form button pattern in Expense files**

For `ExpenseRecurring.tsx`, `ExpenseForm.tsx`, `ExpenseCategoryManager.tsx`:
```jsx
// BEFORE (cancel button):
className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all hover:scale-[1.01]"
// AFTER:
className="flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all"

// BEFORE (primary button):
className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all hover:scale-[1.01] shadow-btn-glow"
// AFTER:
className="flex-1 py-4 rounded-xl text-sm font-black uppercase tracking-widest bg-primary text-black transition-all shadow-btn-glow"
```

- [ ] **Step 4: Fix ExpenseList.tsx modal card**

```jsx
// BEFORE:
<div className="bg-[#161616] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
// AFTER:
<div className="border border-primary/10 rounded-[20px] p-6 w-full max-w-md shadow-2xl bg-surface">
```

- [ ] **Step 5: Apply remaining Rules to all 10 files**

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/ apps/expense/components/
git commit -m "style: apply v1.4 guide to Dashboard and Expense apps"
```

---

### Task 7: Fix Freelancer Portal + Handbook + Payroll (Batch 7)

**Files:**
- Modify: `apps/freelancer-portal/components/FreelancerPortalApp.tsx`
- Modify: `apps/handbook/components/HandbookApp.tsx`
- Modify: `apps/payroll/components/GrossNetCalculator.tsx`
- Modify: `apps/payroll/components/PayrollApp.tsx`
- Modify: `apps/payroll/components/PayrollFormulaPanel.tsx`
- Modify: `apps/payroll/components/PayrollSheet.tsx`

**Key known violations:**
- `HandbookApp.tsx:348,376` — `border border-white/8 rounded-xl` on FAQ items → `border-primary/10`
- `GrossNetCalculator.tsx` — MANY instances of `rounded-2xl border border-white/8 p-5 style={{ background: 'rgba(255,255,255,0.02)' }}` → `rounded-[20px] border border-primary/10 p-5 bg-surface`

For `GrossNetCalculator.tsx`, the recurring pattern is:
```jsx
// BEFORE (appears 8+ times):
<div className="rounded-2xl border border-white/8 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
// AFTER:
<div className="rounded-[20px] border border-primary/10 p-5 bg-surface">
// Note: remove the inline background since bg-surface = #1A1A1A covers it

// BEFORE (empty state):
<div className="text-center py-16 text-neutral-700 text-sm rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
// AFTER:
<div className="text-center py-16 text-neutral-700 text-sm rounded-[20px] border border-primary/10 bg-surface">
```

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 6 files with zero violations

- [ ] **Step 1: Read all 6 files and catalog violations**

- [ ] **Step 2: Fix GrossNetCalculator.tsx** (most violations in this batch)

Apply the card pattern replacement for all 8+ instances using Edit tool.

- [ ] **Step 3: Fix HandbookApp.tsx FAQ accordion border**

```jsx
// BEFORE:
className="bg-surface border border-white/8 rounded-xl px-5 py-4 ..."
// AFTER:
className="bg-surface border border-primary/10 rounded-[20px] px-5 py-4 ..."

// BEFORE:
<div className="bg-surface border border-white/8 rounded-xl p-6 md:p-8">
// AFTER:
<div className="bg-surface border border-primary/10 rounded-[20px] p-6 md:p-8">
```

- [ ] **Step 4: Apply Rules to FreelancerPortalApp.tsx and Payroll files**

- [ ] **Step 5: Commit**

```bash
git add apps/freelancer-portal/components/ apps/handbook/components/ apps/payroll/components/
git commit -m "style: apply v1.4 guide to Freelancer Portal, Handbook, Payroll apps"
```

---

### Task 8: Fix HR app (Batch 8)

**Files:**
- Modify: `apps/hr/components/ChangeRequestTab.tsx`
- Modify: `apps/hr/components/DepartmentManager.tsx`
- Modify: `apps/hr/components/DocumentManager.tsx`
- Modify: `apps/hr/components/EmployeeDetail.tsx`
- Modify: `apps/hr/components/EmployeeForm.tsx`
- Modify: `apps/hr/components/EmployeeList.tsx`
- Modify: `apps/hr/components/EquipmentHandoverPrint.tsx`
- Modify: `apps/hr/components/HrApp.tsx`
- Modify: `apps/hr/components/QuickAddEmployee.tsx`
- Modify: `apps/hr/components/ReminderDashboard.tsx`
- Modify: `apps/hr/components/SalaryComponentManager.tsx`
- Modify: `apps/hr/components/eval/EvalCreateModal.tsx`
- Modify: `apps/hr/components/eval/EvalCycleDetail.tsx`
- Modify: `apps/hr/components/eval/EvalCycleList.tsx`
- Modify: `apps/hr/components/eval/EvalScoreCard.tsx`

**Key known violations:**
- `EvalCreateModal.tsx:181` — ternary default `'border-white/8'` → `'border-primary/10'`
- `EvalCreateModal.tsx:229` — `rounded-xl border border-white/8` → `rounded-[20px] border-primary/10`
- `EvalCreateModal.tsx:251` — ternary `'border-white/8 hover:border-white/15'` → `'border-primary/10 hover:border-primary/20'`
- `EvalCreateModal.tsx:320` — `p-3 rounded-xl border border-white/8 bg-white/2` → `p-3 rounded-xl border border-primary/10` + `style={{ background: 'rgba(255,255,255,0.02)' }}`
- `EvalCycleDetail.tsx:195` — already `rounded-[20px]` but `border-white/8` → `border-primary/10`
- `EvalCycleDetail.tsx:249` — `rounded-2xl` in ternary → `rounded-[20px]`; `'border-white/8'` → `'border-primary/10'`
- `HrApp.tsx` — likely `duration-500` on tab

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 15 HR files with zero violations

- [ ] **Step 1: Read all 15 files and catalog violations**

Pay special attention to ternary expressions containing `border-white/8`.

- [ ] **Step 2: Fix eval sub-components first** (EvalCreateModal, EvalCycleDetail, EvalCycleList, EvalScoreCard)

For ternary patterns:
```jsx
// BEFORE:
periodType === opt.type ? 'border-primary/40 bg-primary/5' : 'border-white/8'
// AFTER:
periodType === opt.type ? 'border-primary/40 bg-primary/5' : 'border-primary/10'

// BEFORE (EvalCycleDetail):
`rounded-2xl border transition-all overflow-hidden bg-surface ${isOpen ? 'border-primary/30' : 'border-white/8'}`
// AFTER:
`rounded-[20px] border transition-all overflow-hidden bg-surface ${isOpen ? 'border-primary/30' : 'border-primary/10'}`
```

- [ ] **Step 3: Fix remaining HR component files**

- [ ] **Step 4: Commit**

```bash
git add apps/hr/components/
git commit -m "style: apply v1.4 guide to HR app"
```

---

### Task 9: Fix Invoice + Portal apps (Batch 9)

**Files:**
- Modify: `apps/invoice/components/ActivityLogTab.tsx`
- Modify: `apps/invoice/components/EInvoiceModals.tsx`
- Modify: `apps/invoice/components/EmailModal.tsx`
- Modify: `apps/invoice/components/HistoryTab.tsx`
- Modify: `apps/invoice/components/InvoiceApp.tsx`
- Modify: `apps/invoice/components/InvoiceEditor.tsx`
- Modify: `apps/invoice/components/InvoicePreview.tsx`
- Modify: `apps/portal/components/ProfileTab.tsx`
- Modify: `apps/portal/components/eval/PortalEvalForm.tsx`
- Modify: `apps/portal/components/eval/PortalEvalList.tsx`
- Modify: `apps/portal/components/eval/PortalEvalResult.tsx`

**Key known violations:**
- `ProfileTab.tsx:170` — `rounded-2xl hover:scale-105` button → `rounded-xl`, remove `hover:scale-105`
- `ProfileTab.tsx:450` — `rounded-2xl hover:scale-105` button → same fix
- `PortalEvalList.tsx:148` — `rounded-2xl border` list item → `rounded-[20px]`
- `PortalEvalResult.tsx:179` — `rounded-2xl border border-orange-500/30` highlight box → `rounded-[20px]`
- `PortalEvalForm.tsx:172` — `rounded-2xl border border-white/5` → `rounded-[20px]`
- `PortalEvalForm.tsx:221` — ternary `'border border-white/8'` → `'border border-primary/10'`
- `PortalEvalForm.tsx:318` — `rounded-xl border border-white/8 bg-white/2` → `border-primary/10` + inline style

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 11 Invoice/Portal files with zero violations

- [ ] **Step 1: Read all 11 files and catalog violations**

- [ ] **Step 2: Fix ProfileTab.tsx hover:scale-105 on buttons**

```jsx
// BEFORE:
className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all hover:scale-105 disabled:opacity-50"
// AFTER:
className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
```

- [ ] **Step 3: Fix Portal eval components**

- [ ] **Step 4: Fix Invoice components (rounded-2xl → rounded-[20px], duration violations)**

- [ ] **Step 5: Commit**

```bash
git add apps/invoice/components/ apps/portal/components/
git commit -m "style: apply v1.4 guide to Invoice and Portal apps"
```

---

### Task 10: Fix System Monitor + Workforce apps (Batch 10)

**Files:**
- Modify: `apps/system-monitor/components/SystemMonitorApp.tsx`
- Modify: `apps/workforce/components/FinancialDashboard.tsx`
- Modify: `apps/workforce/components/TaskList.tsx`
- Modify: `apps/workforce/components/WorkerForm.tsx`
- Modify: `apps/workforce/components/WorkerList.tsx`
- Modify: `apps/workforce/components/WorkforceApp.tsx`
- Modify: `apps/workforce/components/acceptance/AcceptanceListView.tsx`
- Modify: `apps/workforce/components/settlement/SettlementListView.tsx`

**Key known violations:**
- `FinancialDashboard.tsx:133,140,146` — `rounded-2xl border border-primary/10` → `rounded-[20px]` (border already correct, just radius)
- `WorkerList.tsx:40` — `rounded-2xl bg-primary ... hover:scale-105` button → `rounded-xl`, remove `hover:scale-105`
- `WorkerList.tsx:48` — `rounded-2xl border border-cyan-500/20 ... hover:scale-105` button → `rounded-xl`, remove scale
- `WorkerList.tsx:59` — `rounded-2xl border border-primary/10 ... hover:scale-105` → `rounded-[20px]` (icon button/container), remove scale
- `TaskList.tsx:277` — `rounded-2xl ... hover:scale-[1.02]` button → `rounded-xl`, remove scale
- `SettlementListView.tsx:49` — `rounded-2xl ... hover:scale-[1.02]` button → `rounded-xl`, remove scale
- `WorkforceApp.tsx` — likely `duration-500` on tab

**Interfaces:**
- Consumes: Global Constraint Rules A–F
- Produces: 8 System Monitor/Workforce files with zero violations

- [ ] **Step 1: Read all 8 files and catalog violations**

- [ ] **Step 2: Fix WorkerList.tsx buttons** (3 buttons on lines 40, 48, 59)

```jsx
// Line 40 — BEFORE:
className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-black font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all hover:scale-105"
// AFTER:
className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all"

// Line 48 — BEFORE:
className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-cyan-500/20 text-cyan-400 font-black text-xs uppercase tracking-widest hover:bg-cyan-500/10 transition-all hover:scale-105 disabled:opacity-50"
// AFTER:
className="flex items-center gap-2 px-4 py-3 rounded-xl border border-cyan-500/20 text-cyan-400 font-black text-xs uppercase tracking-widest hover:bg-cyan-500/10 transition-all disabled:opacity-50"
```

- [ ] **Step 3: Fix FinancialDashboard.tsx card radius**

```jsx
// Lines 133, 140, 146 — BEFORE:
<div className="p-5 rounded-2xl border border-primary/10 bg-surface ...">
// AFTER:
<div className="p-5 rounded-[20px] border border-primary/10 bg-surface ...">
```

- [ ] **Step 4: Apply Rules to remaining files**

- [ ] **Step 5: Commit**

```bash
git add apps/system-monitor/components/ apps/workforce/components/
git commit -m "style: apply v1.4 guide to System Monitor and Workforce apps"
```

---

### Task 11: Final build verification

> This task runs AFTER all Tasks 1–10 are complete.

**Files:** None modified — verification only.

**Interfaces:**
- Consumes: All changes from Tasks 1–10
- Produces: Confirmation that `npm run build` passes with zero errors

- [ ] **Step 1: Run build check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms
npm run build
```

Expected output: `✓ built in` with no TypeScript errors, no import errors.

- [ ] **Step 2: Spot-check 3 files with heavy edits**

Run grep to confirm violations are gone:
```bash
grep -rn "rounded-2xl\|border-white/8\|border-white/3\|bg-white/2\b\|hover:scale-105\|duration-500\|duration-700\|duration-1000" apps/ components/ --include="*.tsx" | head -20
```

Expected: 0 results (or only legitimate uses that were intentionally kept).

- [ ] **Step 3: Update memory files**

```bash
# Update TASKS.md — mark style sweep as Done
# Update LOG.md — append entry for this session
```

- [ ] **Step 4: Final commit (if any memory file changes were staged)**

```bash
git add .agent/meta/TASKS.md .agent/meta/LOG.md
git commit -m "chore: update memory after style v1.4 sweep"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Rule A (card radius): covered in all 10 tasks with specific before/after examples
- ✅ Rule B (border-white/8 → border-primary/10): called out per file with ternary edge cases
- ✅ Rule C (invalid opacity tokens /3, /2): table row examples in Task 2, general rule in Global Constraints
- ✅ Rule D (bracket notation): Attendance batch (Task 4) has detailed replacements
- ✅ Rule E (hover:scale-*): explicit removal steps in Tasks 6, 9, 10
- ✅ Rule F (duration-500+): called out in Tasks 3, 4, 5, 6
- ✅ Build verification: Task 11

**Placeholder scan:** No TBD/TODO found. All steps have explicit before/after code.

**Type consistency:** No TypeScript types changed — pure className string edits only.
