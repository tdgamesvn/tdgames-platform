# Tax Portal (Kế toán thuế thuê ngoài) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an outsourced tax accountant (not an employee) their own login with a new `ke_toan_thue` role, landing on a dedicated `#tax-portal` mini-app that shows read-only accounting/tax data (invoices, expenses, bank, savings/loans, BHXH, FX rates, payroll/TNCN) with CSV/Excel export — no write access anywhere, and no visibility into other mini-apps.

**Architecture:** Additive-only, mirrors the existing `#portal` / `#freelancer-portal` self-service app pattern (own folder under `apps/`, own service file doing plain `supabase.from().select()` reads, wired into `App.tsx`'s router + `config/apps.ts` registry). New role gets brand-new **SELECT-only** RLS policies added alongside existing policies (no existing policy is dropped/modified) across the ~12 tables in scope. Exports reuse the exact CSV pattern already proven in `VatTab.tsx`/`TncnTab.tsx` and the Excel pattern in `payrollExportService.ts` — no new export library.

**Tech Stack:** Supabase Postgres (RLS via existing `public.jwt_has_any_role()`), React 19 + TS, `xlsx` (already a dependency, used by `payrollExportService.ts`).

## Global Constraints

- Read-only for this role everywhere — no INSERT/UPDATE/DELETE RLS policy is ever added for `ke_toan_thue`, only `FOR SELECT`.
- Data scope confirmed by sếp (temporary, will be tightened later — note this in the UI/policy comments so a future session knows it's intentionally broad): full read access to `invoice_invoices`, `invoice_line_items`, `expense_expenses`, `expense_categories`, `expense_recurring`, `finance_bank_accounts`, `finance_bank_balance_snapshots`, `acc_savings`, `acc_loans`, `acc_bhxh_payments`, `finance_fx_rates`, `pay_payroll_sheets`, `pay_payroll_records`. No other table gets a new policy in this plan.
- Follow existing RLS helper: `public.jwt_has_any_role(ARRAY['...'])` — defined in `supabase/migrations/20260702090000_multirole_rls_jwt_has_any_role.sql:43-49`. Do not write a new helper function.
- Role plumbing is duplicated in 3 places in this codebase (pre-existing pattern, not introduced by this plan): `types.ts:84` (`AccountUser.role` union), `services/authService.ts:4` (`VALID_ROLES` array), `App.tsx:29` (`VALID_ROLES` array, separately declared). All three must be updated together or login will silently downgrade the new role to `'member'` (see `parseRole` fallback in both files).
- UI must follow `.agent/meta/STYLE_GUIDE.md` (bg-surface cards, `text-[10px] font-black uppercase` badges, no `max-w-*` in tab components).
- No test runner in this repo — verification is `npm run build` + the `/verify` skill, per existing convention.
- Run GitNexus `impact()` before editing any existing symbol (`App.tsx` router, `config/apps.ts`, `HomeScreen.tsx`) and `detect_changes({scope:"compare", base_ref:"main"})` before each commit, per this repo's CLAUDE.md.

---

## File Structure

| File | Responsibility |
|---|---|
| `types.ts` (modify) | Add `'ke_toan_thue'` to `AccountUser.role` union (line 84) |
| `services/authService.ts` (modify) | Add `'ke_toan_thue'` to `VALID_ROLES` (line 4) |
| `App.tsx` (modify) | Add `'ke_toan_thue'` to its own `VALID_ROLES` (line 29), add `'tax-portal'` to `VALID_APPS` (line 36), add router branch for `activeApp === 'tax-portal'` |
| `config/apps.ts` (modify) | Add `tax-portal` entry to `APPS` registry with `roles: ['ke_toan_thue']` |
| `supabase/migrations/20260708100000_tax_portal_role_rls.sql` (new) | Additive `FOR SELECT` policies for `ke_toan_thue` across the 12 in-scope tables |
| `apps/tax-portal/services/taxPortalService.ts` (new) | Read-only fetch functions, one per data domain, each returning plain arrays |
| `apps/tax-portal/services/taxPortalExportService.ts` (new) | CSV/Excel export functions, one per domain, reusing the `VatTab.tsx` CSV pattern and `payrollExportService.ts` Excel pattern |
| `apps/tax-portal/components/TaxPortalApp.tsx` (new) | Shell: header, tab nav (`Tổng quan`, `Hoá đơn`, `Chi phí`, `Ngân hàng`, `Tài sản & Vay`, `BHXH`, `Lương/TNCN`), routes to per-domain tab components |
| `apps/tax-portal/components/TaxPortalOverviewTab.tsx` (new) | Summary KPI cards (total revenue, total expense, total AR, total payroll cost this year) |
| `apps/tax-portal/components/TaxPortalInvoiceTab.tsx` (new) | Read-only invoice table + `⬇ Xuất CSV` button |
| `apps/tax-portal/components/TaxPortalExpenseTab.tsx` (new) | Read-only expense table + export button |
| `apps/tax-portal/components/TaxPortalBankTab.tsx` (new) | Bank accounts + balance snapshot history, read-only |
| `apps/tax-portal/components/TaxPortalAssetsTab.tsx` (new) | Savings + loans, read-only |
| `apps/tax-portal/components/TaxPortalPayrollTab.tsx` (new) | Payroll sheets/records read-only table + reuse `payrollExportService.ts` Excel export |

---

### Task 1: Add `ke_toan_thue` role end-to-end (type + login + registry, placeholder app)

**Files:**
- Modify: `types.ts:84`
- Modify: `services/authService.ts:4`
- Modify: `App.tsx:29, 36`, plus new router branch
- Modify: `config/apps.ts` (add new entry)
- Create: `apps/tax-portal/components/TaxPortalApp.tsx` (placeholder shell only — real tabs come in Task 4)

**Interfaces:**
- Consumes: `AccountUser` type (`types.ts`), `hasRole`/`hasAnyRole` (`utils/roleUtils.ts`, unchanged signatures).
- Produces: `AccountUser['role']` now includes `'ke_toan_thue'`; `<TaxPortalApp currentUser={AccountUser} onBack={() => void} />` component that later tasks fill in.

- [ ] **Step 1: Run impact analysis**

Run GitNexus `impact({target: "AccountUser", direction: "upstream"})` and `impact({target: "parseRole", direction: "upstream"})`. Both are widened (union type gets one more member, `VALID_ROLES` array gets one more string) — expect MEDIUM-risk fan-out (every `role ===` check in the codebase is a potential caller) but no BREAKING change since we're only adding a member, not removing/renaming one. Report the caller list to sếp before continuing; if GitNexus is not connected this session, note it in the commit message per this repo's existing convention (see `20260707` LOG.md entries) and proceed carefully.

- [ ] **Step 2: Widen the role union in `types.ts`**

In `types.ts`, find (line 84):

```ts
  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer' | 'bd';
```

Replace with:

```ts
  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer' | 'bd' | 'ke_toan_thue';
```

- [ ] **Step 3: Widen `VALID_ROLES` in `services/authService.ts`**

In `services/authService.ts`, find (line 4):

```ts
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd'] as const;
```

Replace with:

```ts
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd', 'ke_toan_thue'] as const;
```

- [ ] **Step 4: Widen `VALID_ROLES` and `VALID_APPS` in `App.tsx`**

In `App.tsx`, find (line 29):

```ts
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd'] as const;
```

Replace with:

```ts
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd', 'ke_toan_thue'] as const;
```

Find (line 36):

```ts
const VALID_APPS = ['dashboard', 'invoice', 'expense', 'workforce', 'crm', 'hr', 'attendance', 'payroll', 'portal', 'freelancer-portal', 'accounting', 'company', 'ai-agent', 'system-monitor', 'handbook'];
```

Replace with:

```ts
const VALID_APPS = ['dashboard', 'invoice', 'expense', 'workforce', 'crm', 'hr', 'attendance', 'payroll', 'portal', 'freelancer-portal', 'accounting', 'company', 'ai-agent', 'system-monitor', 'handbook', 'tax-portal'];
```

- [ ] **Step 5: Add the router branch in `App.tsx`**

Add the import near the other app imports (after `import FreelancerPortalApp from './apps/freelancer-portal/components/FreelancerPortalApp';`):

```ts
import TaxPortalApp from './apps/tax-portal/components/TaxPortalApp';
```

Add the router branch right after the existing `freelancer-portal` branch (after the block ending `return <FreelancerPortalApp currentUser={currentUser} onBack={handleBack} />;`):

```tsx
  if (activeApp === 'tax-portal') {
    return <TaxPortalApp currentUser={currentUser} onBack={handleBack} />;
  }
```

- [ ] **Step 6: Create the placeholder `TaxPortalApp`**

```tsx
// apps/tax-portal/components/TaxPortalApp.tsx
import React from 'react';
import { AccountUser } from '@/types';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

const TaxPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <button onClick={onBack} className="text-neutral-medium text-xs font-bold uppercase tracking-wider mb-4">
        ← Trang chủ
      </button>
      <h1 className="text-2xl font-black mb-2">🧾 Tax Portal</h1>
      <p className="text-neutral-medium text-sm">Xin chào {currentUser.username}. Các tab dữ liệu sẽ có ở Task 4.</p>
    </div>
  );
};

export default TaxPortalApp;
```

- [ ] **Step 7: Register the app tile in `config/apps.ts`**

Add a new entry to the `APPS` array (after the `handbook` entry, before the closing `];`):

```ts
  {
    id: 'tax-portal',
    name: 'Tax Portal',
    icon: '🧾',
    description: 'Kế toán thuế — xem & xuất dữ liệu',
    color: '#EAB308',
    gradient: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
    roles: ['ke_toan_thue'],
  },
```

- [ ] **Step 8: Build check**

Run: `npm run build`
Expected: exits 0, no TS errors about the widened union (if there's an exhaustive `switch(role)` anywhere that now fails to compile, add a `case 'ke_toan_thue':` arm there too — search first with `grep -rn "switch (.*\.role)\|switch(.*\.role)" --include=*.tsx --include=*.ts .` before assuming none exist).

- [ ] **Step 9: Commit**

```bash
git add types.ts services/authService.ts App.tsx config/apps.ts apps/tax-portal/components/TaxPortalApp.tsx
git commit -m "feat(auth): add ke_toan_thue role + tax-portal app shell"
```

---

### Task 2: RLS migration — SELECT-only policies for `ke_toan_thue`

**Files:**
- Create: `supabase/migrations/20260708100000_tax_portal_role_rls.sql`

**Interfaces:**
- Produces: new additive `FOR SELECT` policies (one per table, named `<table>_ke_toan_thue_read`) on `invoice_invoices`, `invoice_line_items`, `expense_expenses`, `expense_categories`, `expense_recurring`, `finance_bank_accounts`, `finance_bank_balance_snapshots`, `acc_savings`, `acc_loans`, `acc_bhxh_payments`, `finance_fx_rates`, `pay_payroll_sheets`, `pay_payroll_records`.

- [ ] **Step 1: Read migration best-practice skill**

Invoke skill `supabase:supabase-postgres-best-practices` before writing SQL (per this repo's CLAUDE.md rule).

- [ ] **Step 2: Confirm table names and RLS status before writing policies**

Run `mcp__supabase__list_tables({schemas:["public"], verbose:true})` and grep the result for the 13 table names above. Confirm every one exists, has RLS already enabled (all should, per this repo's `2026-07-02` RLS audit), and note their primary key column name (expected `id uuid` for all, per existing convention) — abort and report to sếp if any table name doesn't match (e.g. if `invoice_line_items` turns out to be JSONB embedded in `invoice_invoices.items` rather than a separate table, skip that line from the migration and note it in the commit message instead of guessing).

- [ ] **Step 3: Write the migration**

```sql
-- Tax Portal: outsourced tax accountant (kế toán thuế thuê ngoài) gets a new
-- role `ke_toan_thue` with SELECT-only access to accounting/tax-relevant
-- tables. These are ADDITIVE policies — no existing policy is dropped or
-- modified, so admin/ke_toan/hr access is unaffected. Postgres combines
-- multiple permissive RLS policies with OR, so this purely widens read
-- access for the new role without touching write policies anywhere.
--
-- ponytail: scope is intentionally broad (full payroll detail included) per
-- sếp's explicit decision on 2026-07-08 — "tạm thời xem hết, sau siết lại".
-- When tightening later, the payroll policy below is the first candidate to
-- narrow (e.g. drop pay_payroll_records, keep only pay_payroll_sheets
-- aggregate totals).

CREATE POLICY invoice_invoices_ke_toan_thue_read ON public.invoice_invoices
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY invoice_line_items_ke_toan_thue_read ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_expenses_ke_toan_thue_read ON public.expense_expenses
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_categories_ke_toan_thue_read ON public.expense_categories
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY expense_recurring_ke_toan_thue_read ON public.expense_recurring
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_bank_accounts_ke_toan_thue_read ON public.finance_bank_accounts
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_bank_balance_snapshots_ke_toan_thue_read ON public.finance_bank_balance_snapshots
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_savings_ke_toan_thue_read ON public.acc_savings
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_loans_ke_toan_thue_read ON public.acc_loans
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY acc_bhxh_payments_ke_toan_thue_read ON public.acc_bhxh_payments
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY finance_fx_rates_ke_toan_thue_read ON public.finance_fx_rates
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY pay_payroll_sheets_ke_toan_thue_read ON public.pay_payroll_sheets
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));

CREATE POLICY pay_payroll_records_ke_toan_thue_read ON public.pay_payroll_records
  FOR SELECT TO authenticated
  USING (public.jwt_has_any_role(ARRAY['ke_toan_thue']));
```

If Step 2 found `invoice_line_items` doesn't exist as a standalone table, delete that one `CREATE POLICY` block before applying — `invoice_invoices.items` (JSONB) is already covered by the `invoice_invoices` policy.

- [ ] **Step 4: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `tax_portal_role_rls` and the SQL from Step 3 (adjusted per Step 2's findings).

- [ ] **Step 5: Verify policies exist**

Run:

```sql
SELECT tablename, policyname, cmd FROM pg_policies
WHERE policyname LIKE '%ke_toan_thue_read' ORDER BY tablename;
```

Expected: 12 or 13 rows (depending on Step 2's `invoice_line_items` finding), each `cmd = 'SELECT'`.

- [ ] **Step 6: Check advisors**

Run `mcp__supabase__get_advisors({type:"security"})` — confirm no new warnings introduced (a broad SELECT policy across many tables for one role is intentional here per sếp's decision, but flag to sếp if the advisor surfaces something unexpected like a table missing RLS entirely that this migration would have silently exposed).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260708100000_tax_portal_role_rls.sql
git commit -m "feat(db): add SELECT-only RLS for ke_toan_thue role across accounting/tax tables"
```

---

### Task 3: Read-only data service (`taxPortalService.ts`)

**Files:**
- Create: `apps/tax-portal/services/taxPortalService.ts`

**Interfaces:**
- Consumes: `supabase` client from `services/supabaseClient.ts` (existing, default export pattern used across the codebase, e.g. `import { supabase } from '@/services/supabaseClient';`).
- Produces: `fetchTaxInvoices(): Promise<TaxInvoice[]>`, `fetchTaxExpenses(): Promise<TaxExpense[]>`, `fetchTaxBankAccounts(): Promise<TaxBankAccount[]>`, `fetchTaxBankSnapshots(): Promise<TaxBankSnapshot[]>`, `fetchTaxSavings(): Promise<TaxSaving[]>`, `fetchTaxLoans(): Promise<TaxLoan[]>`, `fetchTaxBhxhPayments(): Promise<TaxBhxhPayment[]>`, `fetchTaxFxRates(): Promise<TaxFxRate[]>`, `fetchTaxPayrollSheets(): Promise<TaxPayrollSheet[]>`, `fetchTaxPayrollRecords(sheetId: string): Promise<TaxPayrollRecord[]>` — these exact names/signatures are what Task 4's tab components import.

- [ ] **Step 1: Write the service**

```ts
// apps/tax-portal/services/taxPortalService.ts
import { supabase } from '@/services/supabaseClient';

export interface TaxInvoice {
  id: string;
  status: string;
  currency: string;
  amount_received: number | null;
  items: any;
  issue_date: string | null;
  paid_date: string | null;
  due_date: string | null;
  created_at: string;
  client_info: any;
  billing_entity: string | null;
}

export interface TaxExpense {
  id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  expense_date: string;
  vendor: string | null;
  category_id: string | null;
  description: string | null;
}

export interface TaxBankAccount {
  id: string;
  name: string;
  bank_name: string;
  currency: string;
}

export interface TaxBankSnapshot {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: string;
}

export interface TaxSaving {
  id: string;
  amount: number;
  bank_name: string | null;
  term_months: number | null;
  interest_rate: number | null;
  start_date: string;
  maturity_date: string | null;
  status: string;
}

export interface TaxLoan {
  id: string;
  amount: number;
  lender: string | null;
  interest_rate: number | null;
  start_date: string;
  due_date: string | null;
  status: string;
}

export interface TaxBhxhPayment {
  id: string;
  amount: number;
  payment_date: string;
  period: string | null;
}

export interface TaxFxRate {
  id: string;
  rate_date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
}

export interface TaxPayrollSheet {
  id: string;
  title: string;
  status: string;
  month: number;
  year: number;
}

export interface TaxPayrollRecord {
  id: string;
  sheet_id: string;
  employee_id: string;
  gross_salary: number;
  net_salary: number;
  pit: number;
  bhxh_employee: number;
  bhxh_company: number;
}

export async function fetchTaxInvoices(): Promise<TaxInvoice[]> {
  const { data, error } = await supabase
    .from('invoice_invoices')
    .select('id, status, currency, amount_received, items, issue_date, paid_date, due_date, created_at, client_info, billing_entity')
    .order('issue_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxInvoice[];
}

export async function fetchTaxExpenses(): Promise<TaxExpense[]> {
  const { data, error } = await supabase
    .from('expense_expenses')
    .select('id, amount, currency, type, status, expense_date, vendor, category_id, description')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxExpense[];
}

export async function fetchTaxBankAccounts(): Promise<TaxBankAccount[]> {
  const { data, error } = await supabase.from('finance_bank_accounts').select('id, name, bank_name, currency');
  if (error) throw error;
  return (data || []) as TaxBankAccount[];
}

export async function fetchTaxBankSnapshots(): Promise<TaxBankSnapshot[]> {
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('id, account_id, balance, snapshot_date, source')
    .order('snapshot_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxBankSnapshot[];
}

export async function fetchTaxSavings(): Promise<TaxSaving[]> {
  const { data, error } = await supabase
    .from('acc_savings')
    .select('id, amount, bank_name, term_months, interest_rate, start_date, maturity_date, status');
  if (error) throw error;
  return (data || []) as TaxSaving[];
}

export async function fetchTaxLoans(): Promise<TaxLoan[]> {
  const { data, error } = await supabase
    .from('acc_loans')
    .select('id, amount, lender, interest_rate, start_date, due_date, status');
  if (error) throw error;
  return (data || []) as TaxLoan[];
}

export async function fetchTaxBhxhPayments(): Promise<TaxBhxhPayment[]> {
  const { data, error } = await supabase
    .from('acc_bhxh_payments')
    .select('id, amount, payment_date, period')
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxBhxhPayment[];
}

export async function fetchTaxFxRates(): Promise<TaxFxRate[]> {
  const { data, error } = await supabase
    .from('finance_fx_rates')
    .select('id, rate_date, from_currency, to_currency, rate, source')
    .order('rate_date', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxFxRate[];
}

export async function fetchTaxPayrollSheets(): Promise<TaxPayrollSheet[]> {
  const { data, error } = await supabase
    .from('pay_payroll_sheets')
    .select('id, title, status, month, year')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return (data || []) as TaxPayrollSheet[];
}

export async function fetchTaxPayrollRecords(sheetId: string): Promise<TaxPayrollRecord[]> {
  const { data, error } = await supabase
    .from('pay_payroll_records')
    .select('id, sheet_id, employee_id, gross_salary, net_salary, pit, bhxh_employee, bhxh_company')
    .eq('sheet_id', sheetId);
  if (error) throw error;
  return (data || []) as TaxPayrollRecord[];
}
```

- [ ] **Step 2: Verify column names against actual schema before build**

Run `mcp__supabase__execute_sql` with:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name IN (
  'invoice_invoices','expense_expenses','finance_bank_accounts','finance_bank_balance_snapshots',
  'acc_savings','acc_loans','acc_bhxh_payments','finance_fx_rates','pay_payroll_sheets','pay_payroll_records'
) ORDER BY table_name, column_name;
```

Cross-check every column name used in Step 1's `select()` calls against this result. **This step exists because the just-completed Dashboard Financial Truth Layer work found 3 pre-existing `select()` calls in `dashboardService.ts` referencing columns that don't exist on `wf_workers`/`pay_payroll_sheets`/`crm_outreach_leads` (400 errors, silently swallowed) — do not repeat that mistake here.** Fix any mismatched column name in the Step 1 code before proceeding (e.g. if `acc_bhxh_payments` doesn't have a `period` column, remove it from the select and the interface).

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/tax-portal/services/taxPortalService.ts
git commit -m "feat(tax-portal): read-only data service for 10 accounting/tax domains"
```

---

### Task 4: Export service (`taxPortalExportService.ts`)

**Files:**
- Create: `apps/tax-portal/services/taxPortalExportService.ts`

**Interfaces:**
- Consumes: `TaxInvoice`, `TaxExpense`, `TaxBankSnapshot`, `TaxSaving`, `TaxLoan`, `TaxBhxhPayment`, `TaxFxRate`, `TaxPayrollRecord` types from `taxPortalService.ts` (Task 3).
- Produces: `exportInvoicesCSV(rows: TaxInvoice[]): void`, `exportExpensesCSV(rows: TaxExpense[]): void`, `exportBankSnapshotsCSV(rows: TaxBankSnapshot[]): void`, `exportSavingsLoansCSV(savings: TaxSaving[], loans: TaxLoan[]): void`, `exportBhxhCSV(rows: TaxBhxhPayment[]): void`, `exportFxRatesCSV(rows: TaxFxRate[]): void`, `exportPayrollExcel(records: TaxPayrollRecord[], sheetTitle: string): void` — these exact names are what Task 5's tab components call from their export buttons.

- [ ] **Step 1: Write the shared CSV helper + per-domain CSV exports**

```ts
// apps/tax-portal/services/taxPortalExportService.ts
import * as XLSX from 'xlsx';
import type { TaxInvoice, TaxExpense, TaxBankSnapshot, TaxSaving, TaxLoan, TaxBhxhPayment, TaxFxRate, TaxPayrollRecord } from './taxPortalService';

// Same pattern as apps/accounting/components/VatTab.tsx's exportCSV — kept
// local (not shared) because each domain's column set is different and this
// repo's existing convention (VatTab/TncnTab) already duplicates this small
// helper per-file rather than extracting it.
function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportInvoicesCSV(rows: TaxInvoice[]) {
  const headers = ['ID', 'Trạng thái', 'Tiền tệ', 'Đã thu', 'Ngày xuất', 'Ngày thanh toán', 'Pháp nhân'];
  const csvRows = rows.map(r => [r.id, r.status, r.currency, r.amount_received ?? 0, r.issue_date || '', r.paid_date || '', r.billing_entity || '']);
  downloadCSV(headers, csvRows, `TaxPortal_HoaDon_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportExpensesCSV(rows: TaxExpense[]) {
  const headers = ['ID', 'Số tiền', 'Tiền tệ', 'Loại', 'Trạng thái', 'Ngày', 'NCC'];
  const csvRows = rows.map(r => [r.id, r.amount, r.currency, r.type, r.status, r.expense_date, r.vendor || '']);
  downloadCSV(headers, csvRows, `TaxPortal_ChiPhi_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBankSnapshotsCSV(rows: TaxBankSnapshot[]) {
  const headers = ['Tài khoản', 'Số dư', 'Ngày', 'Nguồn'];
  const csvRows = rows.map(r => [r.account_id, r.balance, r.snapshot_date, r.source]);
  downloadCSV(headers, csvRows, `TaxPortal_SoDuNganHang_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportSavingsLoansCSV(savings: TaxSaving[], loans: TaxLoan[]) {
  const headers = ['Loại', 'Số tiền', 'Đối tác', 'Lãi suất', 'Ngày bắt đầu', 'Ngày đến hạn', 'Trạng thái'];
  const csvRows = [
    ...savings.map(s => ['Tiết kiệm', s.amount, s.bank_name || '', s.interest_rate ?? '', s.start_date, s.maturity_date || '', s.status]),
    ...loans.map(l => ['Vay', l.amount, l.lender || '', l.interest_rate ?? '', l.start_date, l.due_date || '', l.status]),
  ];
  downloadCSV(headers, csvRows, `TaxPortal_TietKiemVay_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportBhxhCSV(rows: TaxBhxhPayment[]) {
  const headers = ['ID', 'Số tiền', 'Ngày', 'Kỳ'];
  const csvRows = rows.map(r => [r.id, r.amount, r.payment_date, r.period || '']);
  downloadCSV(headers, csvRows, `TaxPortal_BHXH_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportFxRatesCSV(rows: TaxFxRate[]) {
  const headers = ['Ngày', 'Từ', 'Đến', 'Tỷ giá', 'Nguồn'];
  const csvRows = rows.map(r => [r.rate_date, r.from_currency, r.to_currency, r.rate, r.source]);
  downloadCSV(headers, csvRows, `TaxPortal_TyGia_${new Date().toISOString().slice(0, 10)}.csv`);
}

// Excel (not CSV) — same xlsx library + pattern as apps/payroll/services/payrollExportService.ts.
export function exportPayrollExcel(records: TaxPayrollRecord[], sheetTitle: string) {
  const rows = records.map(r => ({
    'Nhân viên ID': r.employee_id,
    'Lương gộp': r.gross_salary,
    'BHXH (NV)': r.bhxh_employee,
    'BHXH (CT)': r.bhxh_company,
    'PIT': r.pit,
    'Lương thực nhận': r.net_salary,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
  XLSX.writeFile(wb, `TaxPortal_Luong_${sheetTitle.replace(/\s/g, '_')}.xlsx`);
}
```

- [ ] **Step 2: Verify `xlsx` import pattern matches existing usage**

Open `apps/payroll/services/payrollExportService.ts` and confirm the exact import statement used there (e.g. `import * as XLSX from 'xlsx';` vs a default import) — match it exactly in Step 1's file so both files behave identically under this project's Vite/TS config (avoids a subtle "works in one file, type error in the other" bug from mismatched import styles).

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/tax-portal/services/taxPortalExportService.ts
git commit -m "feat(tax-portal): CSV/Excel export functions for all 7 data domains"
```

---

### Task 5: Tab components (Overview, Invoice, Expense, Bank, Assets, Payroll)

**Files:**
- Create: `apps/tax-portal/components/TaxPortalOverviewTab.tsx`
- Create: `apps/tax-portal/components/TaxPortalInvoiceTab.tsx`
- Create: `apps/tax-portal/components/TaxPortalExpenseTab.tsx`
- Create: `apps/tax-portal/components/TaxPortalBankTab.tsx`
- Create: `apps/tax-portal/components/TaxPortalAssetsTab.tsx`
- Create: `apps/tax-portal/components/TaxPortalPayrollTab.tsx`

**Interfaces:**
- Consumes: every `fetchTax*` function from `taxPortalService.ts` (Task 3) and every `export*` function from `taxPortalExportService.ts` (Task 4).
- Produces: 6 default-exported React components, each taking no required props (they self-fetch on mount, following the same `useEffect(load, [])` pattern already used throughout this codebase, e.g. `BankBalanceEntryTab.tsx`'s `load` function) — these are what Task 6's `TaxPortalApp` tab router renders.

- [ ] **Step 1: Overview tab**

```tsx
// apps/tax-portal/components/TaxPortalOverviewTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxInvoices, fetchTaxExpenses, fetchTaxPayrollSheets } from '../services/taxPortalService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalOverviewTab: React.FC = () => {
  const [totals, setTotals] = useState({ revenue: 0, expense: 0, invoiceCount: 0, sheetCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTaxInvoices(), fetchTaxExpenses(), fetchTaxPayrollSheets()]).then(([invoices, expenses, sheets]) => {
      const revenue = invoices.reduce((s, i) => s + (i.amount_received || 0), 0);
      const expense = expenses.reduce((s, e) => s + e.amount, 0);
      setTotals({ revenue, expense, invoiceCount: invoices.length, sheetCount: sheets.length });
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-neutral-medium text-sm">Đang tải...</p>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="p-4 rounded-2xl bg-surface border border-white/8">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Doanh thu đã thu</p>
        <p className="text-2xl font-black text-white">{fmt(totals.revenue)} đ</p>
      </div>
      <div className="p-4 rounded-2xl bg-surface border border-white/8">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Tổng chi phí</p>
        <p className="text-2xl font-black text-white">{fmt(totals.expense)} đ</p>
      </div>
      <div className="p-4 rounded-2xl bg-surface border border-white/8">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Số hoá đơn</p>
        <p className="text-2xl font-black text-white">{totals.invoiceCount}</p>
      </div>
      <div className="p-4 rounded-2xl bg-surface border border-white/8">
        <p className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Bảng lương</p>
        <p className="text-2xl font-black text-white">{totals.sheetCount}</p>
      </div>
    </div>
  );
};

export default TaxPortalOverviewTab;
```

- [ ] **Step 2: Invoice tab**

```tsx
// apps/tax-portal/components/TaxPortalInvoiceTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxInvoices, TaxInvoice } from '../services/taxPortalService';
import { exportInvoicesCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalInvoiceTab: React.FC = () => {
  const [rows, setRows] = useState<TaxInvoice[]>([]);
  useEffect(() => { fetchTaxInvoices().then(setRows); }, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportInvoicesCSV(rows)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/8">
              <th className="p-3">Ngày xuất</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Pháp nhân</th>
              <th className="p-3 text-right">Đã thu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.issue_date || '—'}</td>
                <td className="p-3 text-neutral-medium">{r.status}</td>
                <td className="p-3 text-neutral-medium">{r.billing_entity || '—'}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.amount_received || 0)} {r.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalInvoiceTab;
```

- [ ] **Step 3: Expense tab (same table+export pattern as Step 2, different columns)**

```tsx
// apps/tax-portal/components/TaxPortalExpenseTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxExpenses, TaxExpense } from '../services/taxPortalService';
import { exportExpensesCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalExpenseTab: React.FC = () => {
  const [rows, setRows] = useState<TaxExpense[]>([]);
  useEffect(() => { fetchTaxExpenses().then(setRows); }, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportExpensesCSV(rows)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/8">
              <th className="p-3">Ngày</th>
              <th className="p-3">Loại</th>
              <th className="p-3">NCC</th>
              <th className="p-3 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.expense_date}</td>
                <td className="p-3 text-neutral-medium">{r.type}</td>
                <td className="p-3 text-neutral-medium">{r.vendor || '—'}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.amount)} {r.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalExpenseTab;
```

- [ ] **Step 4: Bank tab**

```tsx
// apps/tax-portal/components/TaxPortalBankTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxBankAccounts, fetchTaxBankSnapshots, TaxBankAccount, TaxBankSnapshot } from '../services/taxPortalService';
import { exportBankSnapshotsCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalBankTab: React.FC = () => {
  const [accounts, setAccounts] = useState<TaxBankAccount[]>([]);
  const [snapshots, setSnapshots] = useState<TaxBankSnapshot[]>([]);

  useEffect(() => {
    Promise.all([fetchTaxBankAccounts(), fetchTaxBankSnapshots()]).then(([a, s]) => {
      setAccounts(a);
      setSnapshots(s);
    });
  }, []);

  const accName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportBankSnapshotsCSV(snapshots)}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất CSV
        </button>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/8">
              <th className="p-3">Tài khoản</th>
              <th className="p-3">Ngày</th>
              <th className="p-3 text-right">Số dư</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map(s => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="p-3 text-white">{accName(s.account_id)}</td>
                <td className="p-3 text-neutral-medium">{s.snapshot_date}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(s.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalBankTab;
```

- [ ] **Step 5: Assets tab (savings + loans + BHXH + FX combined, 4 export buttons)**

```tsx
// apps/tax-portal/components/TaxPortalAssetsTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxSavings, fetchTaxLoans, fetchTaxBhxhPayments, fetchTaxFxRates, TaxSaving, TaxLoan, TaxBhxhPayment, TaxFxRate } from '../services/taxPortalService';
import { exportSavingsLoansCSV, exportBhxhCSV, exportFxRatesCSV } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalAssetsTab: React.FC = () => {
  const [savings, setSavings] = useState<TaxSaving[]>([]);
  const [loans, setLoans] = useState<TaxLoan[]>([]);
  const [bhxh, setBhxh] = useState<TaxBhxhPayment[]>([]);
  const [fx, setFx] = useState<TaxFxRate[]>([]);

  useEffect(() => {
    Promise.all([fetchTaxSavings(), fetchTaxLoans(), fetchTaxBhxhPayments(), fetchTaxFxRates()])
      .then(([s, l, b, f]) => { setSavings(s); setLoans(l); setBhxh(b); setFx(f); });
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-white/8 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">Tiết kiệm & Vay</h3>
          <button onClick={() => exportSavingsLoansCSV(savings, loans)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{savings.length} khoản tiết kiệm, {loans.length} khoản vay</p>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">BHXH</h3>
          <button onClick={() => exportBhxhCSV(bhxh)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{bhxh.length} lần đóng, tổng {fmt(bhxh.reduce((s, b) => s + b.amount, 0))} đ</p>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase text-white">Tỷ giá</h3>
          <button onClick={() => exportFxRatesCSV(fx)}
            className="bg-primary text-black font-black text-[10px] uppercase px-2 py-1.5 rounded-lg">⬇ CSV</button>
        </div>
        <p className="text-neutral-medium text-xs">{fx.length} bản ghi tỷ giá</p>
      </div>
    </div>
  );
};

export default TaxPortalAssetsTab;
```

- [ ] **Step 6: Payroll tab (sheet picker + records + Excel export)**

```tsx
// apps/tax-portal/components/TaxPortalPayrollTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchTaxPayrollSheets, fetchTaxPayrollRecords, TaxPayrollSheet, TaxPayrollRecord } from '../services/taxPortalService';
import { exportPayrollExcel } from '../services/taxPortalExportService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const TaxPortalPayrollTab: React.FC = () => {
  const [sheets, setSheets] = useState<TaxPayrollSheet[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [records, setRecords] = useState<TaxPayrollRecord[]>([]);

  useEffect(() => {
    fetchTaxPayrollSheets().then(s => {
      setSheets(s);
      if (s.length) setSelected(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (selected) fetchTaxPayrollRecords(selected).then(setRecords);
  }, [selected]);

  const currentSheet = sheets.find(s => s.id === selected);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
          {sheets.map(s => <option key={s.id} value={s.id}>{s.title} (T{s.month}/{s.year})</option>)}
        </select>
        <button onClick={() => exportPayrollExcel(records, currentSheet?.title || 'unknown')}
          className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg">
          ⬇ Xuất Excel
        </button>
      </div>
      <div className="bg-surface border border-white/8 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600 uppercase text-[10px] font-black border-b border-white/8">
              <th className="p-3">Nhân viên</th>
              <th className="p-3 text-right">Lương gộp</th>
              <th className="p-3 text-right">BHXH (NV)</th>
              <th className="p-3 text-right">PIT</th>
              <th className="p-3 text-right">Thực nhận</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="p-3 text-white">{r.employee_id}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.gross_salary)}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.bhxh_employee)}</td>
                <td className="p-3 text-right text-neutral-medium">{fmt(r.pit)}</td>
                <td className="p-3 text-right text-white font-bold">{fmt(r.net_salary)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxPortalPayrollTab;
```

- [ ] **Step 7: Build check**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/tax-portal/components/TaxPortalOverviewTab.tsx apps/tax-portal/components/TaxPortalInvoiceTab.tsx apps/tax-portal/components/TaxPortalExpenseTab.tsx apps/tax-portal/components/TaxPortalBankTab.tsx apps/tax-portal/components/TaxPortalAssetsTab.tsx apps/tax-portal/components/TaxPortalPayrollTab.tsx
git commit -m "feat(tax-portal): 6 read-only tabs with per-domain CSV/Excel export"
```

---

### Task 6: Wire real tabs into `TaxPortalApp` (replace Task 1's placeholder)

**Files:**
- Modify: `apps/tax-portal/components/TaxPortalApp.tsx`

**Interfaces:**
- Consumes: all 6 tab components from Task 5.

- [ ] **Step 1: Run impact analysis**

Run GitNexus `impact({target: "TaxPortalApp", direction: "upstream"})` — expect it's the route entrypoint, LOW risk (only `App.tsx`'s router calls it, added in Task 1).

- [ ] **Step 2: Replace the placeholder body with tab navigation**

```tsx
// apps/tax-portal/components/TaxPortalApp.tsx
import React, { useState } from 'react';
import { AccountUser } from '@/types';
import TaxPortalOverviewTab from './TaxPortalOverviewTab';
import TaxPortalInvoiceTab from './TaxPortalInvoiceTab';
import TaxPortalExpenseTab from './TaxPortalExpenseTab';
import TaxPortalBankTab from './TaxPortalBankTab';
import TaxPortalAssetsTab from './TaxPortalAssetsTab';
import TaxPortalPayrollTab from './TaxPortalPayrollTab';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
}

type Tab = 'overview' | 'invoice' | 'expense' | 'bank' | 'assets' | 'payroll';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'invoice', label: 'Hoá đơn' },
  { id: 'expense', label: 'Chi phí' },
  { id: 'bank', label: 'Ngân hàng' },
  { id: 'assets', label: 'Tài sản & BHXH' },
  { id: 'payroll', label: 'Lương / TNCN' },
];

const TaxPortalApp: React.FC<Props> = ({ currentUser, onBack }) => {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-bg text-white p-6">
      <button onClick={onBack} className="text-neutral-medium text-xs font-bold uppercase tracking-wider mb-4">
        ← Trang chủ
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">🧾 Tax Portal</h1>
          <p className="text-neutral-medium text-sm">Xin chào {currentUser.username} — chỉ xem, có thể xuất dữ liệu</p>
        </div>
      </div>
      <div className="flex gap-2 mb-6 border-b border-white/8 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-black uppercase whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-neutral-medium hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <TaxPortalOverviewTab />}
      {tab === 'invoice' && <TaxPortalInvoiceTab />}
      {tab === 'expense' && <TaxPortalExpenseTab />}
      {tab === 'bank' && <TaxPortalBankTab />}
      {tab === 'assets' && <TaxPortalAssetsTab />}
      {tab === 'payroll' && <TaxPortalPayrollTab />}
    </div>
  );
};

export default TaxPortalApp;
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/tax-portal/components/TaxPortalApp.tsx
git commit -m "feat(tax-portal): wire 6 tabs into TaxPortalApp shell"
```

---

### Task 7: Create a real `ke_toan_thue` test account + full regression pass

**Files:** none (verification + one-off SQL, no code changes)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exits 0, no warnings introduced beyond the pre-existing chunk-size warning.

- [ ] **Step 2: GitNexus regression check**

Run `detect_changes({scope: "compare", base_ref: "main"})`. Confirm the affected symbol list matches exactly what this plan touched (role/type widening, `App.tsx` router, `config/apps.ts`, new `apps/tax-portal/*` files) — no unexpected symbols flagged (e.g. if some other file's behavior changed because it does an exhaustive check on `AccountUser.role`, that's expected per Task 1 Step 8's note; anything else is a red flag, stop and investigate).

- [ ] **Step 3: Create a real test account (not a throwaway — this becomes the actual accountant's login, sếp will reset the password afterward)**

Ask sếp for the real outsourced tax accountant's email before running this — do not invent one. Then run `mcp__supabase__execute_sql`:

```sql
with new_user as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    '<sếp-provided email>',
    crypt('<temporary password — sếp will reset via forgot-password flow>', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"],"role":"ke_toan_thue"}',
    '{"role":"ke_toan_thue","username":"Kế toán thuế","full_name":"Kế toán thuế","password_set":true,"email_verified":true}',
    now(), now()
  ) returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email', now(), now(), now()
from new_user
returning user_id, provider_id;
```

- [ ] **Step 4: Full manual walkthrough via Playwright, logged in as `ke_toan_thue`**

Use the Playwright MCP tools (same approach proven in the just-completed Dashboard Financial Truth Layer verify — `mcp__playwright__browser_navigate`, `browser_type`, `browser_click`, `browser_snapshot`, `browser_console_messages`):

1. Login with the Step 3 credentials at `http://localhost:3000` (or the dev port in use) — confirm it lands on the app picker showing **only** the "Tax Portal" tile (verifies `config/apps.ts`'s `roles: ['ke_toan_thue']` filter works — this is the main security check for this task).
2. Click into Tax Portal, click through all 6 tabs — confirm each renders real data with no console errors, and each export button downloads a file without throwing.
3. **Negative test (important — this is a read-only external account):** manually navigate the browser to `http://localhost:3000/#invoice` (an app this role should NOT see) — confirm `App.tsx`'s access guard blocks it (check how other single-purpose roles like `freelancer` are blocked from `#invoice` today — likely falls through to the app picker or shows nothing since `VALID_APPS` includes it but `HomeScreen`'s tile filter would just not show it; the real guard is whichever mechanism prevents direct hash navigation to an unauthorized app for `member`/`freelancer` today — replicate exactly that for `ke_toan_thue`, and if no such per-app guard exists today beyond hiding the tile, report this as a pre-existing gap to sếp rather than silently leaving `ke_toan_thue` with the same gap unaddressed).
4. Confirm no write UI is exposed anywhere in Tax Portal (no add/edit/delete buttons — this plan's tabs are read-only by construction, this step is a final visual confirmation).

- [ ] **Step 5: Update project memory**

Per this repo's CLAUDE.md Memory Protocol, update `.agent/meta/TASKS.md` (move this feature Doing → Done) and append a dated entry to `.agent/meta/LOG.md` describing what was built, the RLS scope decision (full visibility, temporary, to be tightened later per sếp's 2026-07-08 decision), and how it was validated.

- [ ] **Step 6: Final commit**

```bash
git add .agent/meta/TASKS.md .agent/meta/LOG.md
git commit -m "docs: update project memory after tax portal feature"
```

---

## Self-Review Notes

- **Spec coverage:** new role `ke_toan_thue` (Task 1) ✅, RLS read-only across all 12-13 confirmed tables (Task 2) ✅, read service (Task 3) ✅, export CSV/Excel reusing existing patterns (Task 4) ✅, new mini-app UI with per-domain tabs (Task 5-6) ✅, login-like-normal-user + new app confirmed via HomeScreen's existing `roles` filter mechanism, no new auth flow needed (Task 1 Step 7) ✅, regression + real account creation + negative access test (Task 7) ✅.
- **Explicitly deferred (per sếp's 2026-07-08 decision):** tightening the RLS scope (especially full `pay_payroll_records` visibility) — flagged with a `ponytail:` comment directly in the Task 2 migration SQL so a future session finds it without re-asking sếp.
- **Type consistency check:** `TaxInvoice`/`TaxExpense`/`TaxBankSnapshot`/`TaxSaving`/`TaxLoan`/`TaxBhxhPayment`/`TaxFxRate`/`TaxPayrollSheet`/`TaxPayrollRecord` (Task 3) match exactly what Task 4's export functions and Task 5's tab components import (same field names throughout: `amount_received`, `bhxh_employee`, `snapshot_date`, etc.) — verified by hand during writing, must be re-verified against the real schema in Task 3 Step 2 since column names were not confirmed live before this plan was written (existing tables were inferred from `CLAUDE.md`'s table list + patterns in `dashboardService.ts`/`bankBalanceService.ts`, not a live schema dump — Task 3 Step 2 exists specifically to catch any mismatch before it becomes a silent 400 error like the ones found during the Dashboard Financial Truth Layer regression pass).

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-08-tax-portal.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Sếp muốn chọn cách nào?**
