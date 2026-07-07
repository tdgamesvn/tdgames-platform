# CEO Dashboard — Financial Truth Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 4 real gaps in `#dashboard` (no bank balance, no project profitability, AR/AP scattered, hardcoded FX rate) plus add confidence indicators, historical bank balance tracking, and auto-refresh — without building double-entry bookkeeping.

**Architecture:** Additive-only. No existing table is dropped or renamed. Two new tables (`finance_bank_balance_snapshots`, plus nullable `crm_project_id` FK columns on `expense_expenses` and `wf_tasks`). All aggregation stays in `apps/dashboard/services/dashboardService.ts` as plain read queries — no new Edge Function, no ledger, no journal entries. Project profitability and AR/AP summaries reuse existing bucket/status logic already proven in `ARAgingTab.tsx` / `PayablesTab.tsx` rather than reinventing it.

**Tech Stack:** Supabase Postgres (migrations + RLS via existing `public.jwt_has_any_role()`), React 19 + TS, existing `exchangeRateService.ts`.

## Global Constraints

- No legal/statutory bookkeeping requirement — do not build double-entry ledger or auto journal entries (explicitly descoped by sếp).
- Follow existing RLS pattern: `USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))` — see `supabase/migrations/20260702120000_tighten_rls_role_policies.sql:11-16`.
- Follow history-over-mutation pattern already used by `hr_position_history` / `hr_employee_salary` — new bank balance data is an append-only snapshot table, never an update-in-place column.
- No new npm dependencies. No test runner exists in this repo (`package.json` has no `test`/`vitest`/`jest` script) — verification is `npm run build` + manual check via the `/verify` skill, per this repo's existing convention (not pytest/jest steps).
- UI must follow `.agent/meta/STYLE_GUIDE.md` (bg-surface cards, `text-[10px] font-black uppercase` badges, no `max-w-*` in tab components).
- Run GitNexus `impact()` before editing `dashboardService.ts` / `DashboardApp.tsx` (both are existing symbols with callers) and `detect_changes({scope:"compare", base_ref:"main"})` before each commit, per this repo's CLAUDE.md.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260708090000_dashboard_financial_truth.sql` | New table `finance_bank_balance_snapshots`, RLS, `crm_project_id` columns on `expense_expenses` + `wf_tasks`, FK fix on `invoice_invoices.crm_project_id` |
| `services/bankBalanceService.ts` (new, project root `services/`, sibling to `exchangeRateService.ts` since bank balance is cross-app like FX) | CRUD for snapshots: `fetchLatestBalances()`, `fetchBalanceHistory()`, `addBalanceSnapshot()` |
| `apps/dashboard/services/dashboardService.ts` (modify) | Remove hardcoded `USD_TO_VND`, add `confidence` fields, add `cashPosition`, `projectProfitability`, `arApSummary` blocks |
| `apps/dashboard/components/BankBalancePanel.tsx` (new) | Cash position card: total balance, per-account breakdown, staleness badge |
| `apps/dashboard/components/ProjectProfitabilityPanel.tsx` (new) | Estimated vs Verified profit per project, badges |
| `apps/dashboard/components/ArApPanel.tsx` (new) | AR aging bucket totals + AP payable totals, link-through to full tabs |
| `apps/dashboard/components/DashboardApp.tsx` (modify) | Wire new panels in, add polling auto-refresh |
| `apps/accounting/components/BankBalanceEntryTab.tsx` (new) | Manual snapshot entry form (admin/ke_toan) — lives in Accounting app next to `PayablesTab.tsx` |

---

### Task 1: Fix hardcoded FX rate in dashboardService

**Files:**
- Modify: `apps/dashboard/services/dashboardService.ts:1-8, 126-239`

**Interfaces:**
- Consumes: `fetchExchangeRate()`, `avgRate(data)` from `services/exchangeRateService.ts` (already exist, signatures: `fetchExchangeRate(): Promise<ExchangeRateData>`, `avgRate(data: ExchangeRateData): number`).
- Produces: `fetchCeoDashboard()` no longer references module-level `USD_TO_VND` constant; rate is fetched once per call and threaded through.

- [ ] **Step 1: Run impact analysis**

Run GitNexus `impact({target: "fetchCeoDashboard", direction: "upstream"})`. Expect only `DashboardApp.tsx` as caller (LOW risk). Report to sếp before continuing.

- [ ] **Step 2: Import exchange rate service and replace constant**

In `apps/dashboard/services/dashboardService.ts`, replace:

```ts
import { supabase } from '@/services/supabaseClient';

// Tỷ giá quy đổi USD → VND (cập nhật định kỳ)
const USD_TO_VND = 25_500;
```

with:

```ts
import { supabase } from '@/services/supabaseClient';
import { fetchExchangeRate, avgRate } from '@/services/exchangeRateService';

// Fallback nếu VCB edge function lỗi — chỉ dùng khi fetch thất bại.
const FALLBACK_USD_TO_VND = 25_500;
```

- [ ] **Step 3: Fetch live rate at the top of `fetchCeoDashboard`**

Right after the `now`/`selMonth`/`selYear` setup (around line 130-134), add:

```ts
  let usdToVnd = FALLBACK_USD_TO_VND;
  try {
    usdToVnd = avgRate(await fetchExchangeRate());
  } catch {
    // ponytail: VCB edge function down → fall back to last known static rate,
    // dashboard still renders instead of hard-failing.
  }
```

- [ ] **Step 4: Replace every `USD_TO_VND` reference with `usdToVnd`**

Three call sites: line ~199 (`rev += ... * USD_TO_VND`), line ~229 (`receivable += ... * USD_TO_VND`), line ~237 (`const rate = Number(t.exchange_rate) || USD_TO_VND`). Simple find-replace within the function body (not the whole file — the constant no longer exists at module scope).

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: exits 0, no TS errors about unused `USD_TO_VND` or missing import.

- [ ] **Step 6: Manual verify**

Use `/verify` skill on `http://localhost:3000#dashboard` — confirm revenue/receivable numbers change slightly vs before (proves live rate is being used, not the stale 25,500 constant). Cross-check the displayed rate matches `https://portal.vietcombank.com.vn` USD sell rate for today within rounding.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/services/dashboardService.ts
git commit -m "fix(dashboard): use live VCB exchange rate instead of hardcoded 25500"
```

---

### Task 2: Migration — bank balance snapshots + project FK columns

**Files:**
- Create: `supabase/migrations/20260708090000_dashboard_financial_truth.sql`

**Interfaces:**
- Produces: table `public.finance_bank_balance_snapshots(id uuid pk, account_id uuid fk→finance_bank_accounts, balance numeric, snapshot_date date, source text, recorded_by text, created_at timestamptz)`; column `public.expense_expenses.crm_project_id uuid null fk→crm_projects(id)`; column `public.wf_tasks.crm_project_id uuid null fk→crm_projects(id)`.

- [ ] **Step 1: Read migration best-practice skill**

Invoke skill `supabase:supabase-postgres-best-practices` before writing SQL (per this repo's CLAUDE.md rule).

- [ ] **Step 2: Write the migration file**

```sql
-- Dashboard Financial Truth Layer:
-- 1) Bank balance history (append-only, same pattern as hr_position_history)
-- 2) crm_project_id link columns for expense_expenses + wf_tasks so
--    Project Profitability can be computed without free-text matching.
-- 3) FK-ify invoice_invoices.crm_project_id (was plain text with no constraint).

-- ── 1. Bank balance snapshots ──────────────────────────────────
CREATE TABLE public.finance_bank_balance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE,
  balance numeric NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'statement_reconciled')),
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_balance_snapshots_account_date
  ON public.finance_bank_balance_snapshots (account_id, snapshot_date DESC);

ALTER TABLE public.finance_bank_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_bank_balance_snapshots_staff ON public.finance_bank_balance_snapshots
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- ── 2. Project FK columns ──────────────────────────────────────
ALTER TABLE public.expense_expenses
  ADD COLUMN IF NOT EXISTS crm_project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL;

ALTER TABLE public.wf_tasks
  ADD COLUMN IF NOT EXISTS crm_project_id uuid REFERENCES public.crm_projects(id) ON DELETE SET NULL;

-- No backfill: existing `project` / `project_name` free-text fields stay as
-- display fallback. Confidence indicator (Task 4) surfaces the % still
-- unmapped instead of guessing a match.

-- ── 3. FK-ify invoice_invoices.crm_project_id ──────────────────
-- Column already exists as `text` with no constraint. Null out any value
-- that isn't a valid crm_projects.id before adding the FK, so the
-- migration can't fail on dirty data.
UPDATE public.invoice_invoices
SET crm_project_id = NULL
WHERE crm_project_id IS NOT NULL
  AND crm_project_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.invoice_invoices i
SET crm_project_id = NULL
WHERE i.crm_project_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.crm_projects p WHERE p.id = i.crm_project_id::uuid);

ALTER TABLE public.invoice_invoices
  ALTER COLUMN crm_project_id TYPE uuid USING crm_project_id::uuid;

ALTER TABLE public.invoice_invoices
  ADD CONSTRAINT invoice_invoices_crm_project_id_fkey
  FOREIGN KEY (crm_project_id) REFERENCES public.crm_projects(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `dashboard_financial_truth` and the SQL above (this repo applies migrations to prod via MCP, per the pattern seen in `20260702120000_tighten_rls_role_policies.sql:5`).

- [ ] **Step 4: Verify schema**

Run `mcp__supabase__list_tables({schemas:["public"], verbose:true})` filtered to `finance_bank_balance_snapshots`, `expense_expenses`, `wf_tasks`, `invoice_invoices` — confirm new columns/table exist with correct types.

- [ ] **Step 5: Check advisors**

Run `mcp__supabase__get_advisors({type:"security"})` — confirm no new RLS warnings on the new table.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260708090000_dashboard_financial_truth.sql
git commit -m "feat(db): add bank balance snapshots table + crm_project_id FKs for dashboard"
```

---

### Task 3: Bank balance service + manual entry UI

**Files:**
- Create: `services/bankBalanceService.ts`
- Create: `apps/accounting/components/BankBalanceEntryTab.tsx`
- Modify: `apps/accounting/components/AccountingApp.tsx` (add tab)

**Interfaces:**
- Consumes: `BankAccount` type from `apps/expense/services/bankAccountService.ts` (`fetchBankAccounts(): Promise<BankAccount[]>`).
- Produces: `fetchLatestBalances(): Promise<BankBalanceSnapshot[]>` (one row per account = most recent snapshot), `fetchBalanceHistory(accountId: string, days?: number): Promise<BankBalanceSnapshot[]>`, `addBalanceSnapshot(input: NewSnapshot): Promise<void>` — these are what Task 5 (dashboard cash position) and Task 8 (history chart, if added later) consume.

- [ ] **Step 1: Create the service**

```ts
// services/bankBalanceService.ts
import { supabase } from './supabaseClient';

export interface BankBalanceSnapshot {
  id: string;
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: 'manual' | 'statement_reconciled';
  recorded_by: string | null;
  created_at: string;
}

/** Most recent snapshot per account (one row per account_id). */
export async function fetchLatestBalances(): Promise<BankBalanceSnapshot[]> {
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  const latest = new Map<string, BankBalanceSnapshot>();
  for (const row of (data || []) as BankBalanceSnapshot[]) {
    if (!latest.has(row.account_id)) latest.set(row.account_id, row);
  }
  return Array.from(latest.values());
}

export async function fetchBalanceHistory(accountId: string, days = 90): Promise<BankBalanceSnapshot[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('finance_bank_balance_snapshots')
    .select('*')
    .eq('account_id', accountId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  return (data || []) as BankBalanceSnapshot[];
}

export async function addBalanceSnapshot(input: {
  account_id: string;
  balance: number;
  snapshot_date: string;
  source: 'manual' | 'statement_reconciled';
  recorded_by: string;
}): Promise<void> {
  const { error } = await supabase.from('finance_bank_balance_snapshots').insert(input);
  if (error) throw error;
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 3: Create the manual entry tab**

```tsx
// apps/accounting/components/BankBalanceEntryTab.tsx
import React, { useEffect, useState } from 'react';
import { fetchBankAccounts, BankAccount } from '@/apps/expense/services/bankAccountService';
import { fetchLatestBalances, addBalanceSnapshot, BankBalanceSnapshot } from '@/services/bankBalanceService';
import { AccountUser } from '@/types';

interface Props { currentUser: AccountUser }

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const BankBalanceEntryTab: React.FC<Props> = ({ currentUser }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [latest, setLatest] = useState<BankBalanceSnapshot[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => {
    Promise.all([fetchBankAccounts(), fetchLatestBalances()]).then(([a, l]) => {
      setAccounts(a);
      setLatest(l);
    });
  };
  useEffect(load, []);

  const latestFor = (accId: string) => latest.find(l => l.account_id === accId);
  const staleDays = (dateStr?: string) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  };

  const save = async (accId: string) => {
    const val = Number(draft[accId]);
    if (!val && val !== 0) return;
    setSaving(accId);
    try {
      await addBalanceSnapshot({
        account_id: accId,
        balance: val,
        snapshot_date: new Date().toISOString().slice(0, 10),
        source: 'manual',
        recorded_by: currentUser.username,
      });
      setDraft(d => ({ ...d, [accId]: '' }));
      load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3">
      {accounts.map(acc => {
        const l = latestFor(acc.id);
        const stale = staleDays(l?.snapshot_date);
        return (
          <div key={acc.id} className="bg-surface border border-white/8 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold text-sm">{acc.name} <span className="text-neutral-medium text-xs">({acc.bank_name})</span></p>
              <p className="text-xs text-neutral-medium mt-1">
                Số dư gần nhất: <span className="text-white font-bold">{l ? fmt(l.balance) : '—'}</span> {acc.currency}
                {stale !== null && (
                  <span className={`ml-2 text-[10px] font-black uppercase ${stale > 7 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {stale === 0 ? 'Hôm nay' : `${stale} ngày trước`}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Số dư mới"
                value={draft[acc.id] || ''}
                onChange={e => setDraft(d => ({ ...d, [acc.id]: e.target.value }))}
                className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 w-32 text-sm text-white" />
              <button onClick={() => save(acc.id)} disabled={saving === acc.id}
                className="bg-primary text-black font-black text-xs uppercase px-3 py-2 rounded-lg disabled:opacity-50">
                {saving === acc.id ? '...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BankBalanceEntryTab;
```

- [ ] **Step 4: Wire the tab into AccountingApp**

Run GitNexus `impact({target: "AccountingApp", direction: "upstream"})` first — report risk level. Then open `apps/accounting/components/AccountingApp.tsx`, find where `PayablesTab` is registered as a tab (same pattern: tab id, label, accessible roles `['admin','ke_toan']`), and add a new tab entry `{ id: 'bank-balance', label: 'Số dư ngân hàng', component: <BankBalanceEntryTab currentUser={currentUser} /> }` following the exact structure already used for the existing tabs in that file.

- [ ] **Step 5: Build + manual verify**

Run: `npm run build` — expect exit 0.
Use `/verify` skill: navigate to `#accounting` → new tab → enter a balance for one account → confirm it saves and "Hôm nay" badge shows.

- [ ] **Step 6: Commit**

```bash
git add services/bankBalanceService.ts apps/accounting/components/BankBalanceEntryTab.tsx apps/accounting/components/AccountingApp.tsx
git commit -m "feat(accounting): manual bank balance snapshot entry"
```

---

### Task 4: Confidence indicators + cash position + project profitability + AR/AP in dashboardService

**Files:**
- Modify: `apps/dashboard/services/dashboardService.ts`

**Interfaces:**
- Consumes: `fetchLatestBalances()` from `services/bankBalanceService.ts` (Task 3); `crm_project_id` columns from Task 2.
- Produces: `CeoDashboardData.confidence`, `CeoDashboardData.cashPosition`, `CeoDashboardData.projectProfitability`, `CeoDashboardData.arApSummary` — new top-level blocks consumed by Task 5's panels.

- [ ] **Step 1: Run impact analysis**

Run GitNexus `impact({target: "fetchCeoDashboard", direction: "upstream"})` again (schema of return type is changing — confirm `DashboardApp.tsx` is still the only consumer before widening the interface).

- [ ] **Step 2: Extend `CeoDashboardData` interface**

Add after the existing `pipeline` block (around line 79):

```ts
  // ── Cash position (real bank balance) ──
  cashPosition: {
    totalVnd: number;
    accounts: { name: string; balance: number; currency: string; staleDays: number | null; source: string }[];
    staleDays: number | null; // max staleness across accounts
  };
  // ── Data confidence per block ──
  confidence: {
    revenue: { mapped: number; total: number };   // invoices with crm_project_id set
    projectCost: { mapped: number; total: number }; // expenses+tasks with crm_project_id set
    cashPosition: { staleDays: number | null };
  };
  // ── Project profitability (estimated vs verified) ──
  projectProfitability: {
    projectId: string;
    projectName: string;
    estimatedRevenue: number;
    estimatedCost: number;
    estimatedProfit: number;
    verifiedRevenue: number;
    verifiedCost: number;
    verifiedProfit: number;
  }[];
  // ── AR/AP summary ──
  arApSummary: {
    arTotal: number;
    arBuckets: { bucket: string; total: number }[];
    apTotal: number;
    apTopVendors: { vendor: string; total: number }[];
  };
```

- [ ] **Step 3: Add cash position block**

Import at top: `import { fetchLatestBalances } from '@/services/bankBalanceService';`

Inside `fetchCeoDashboard`, add to the `Promise.all` alongside existing queries — actually keep it separate since it's a different service, not a raw `supabase.from()` call. After the existing `Promise.all` block, add:

```ts
  const balances = await fetchLatestBalances().catch(() => []);
  const bankAccountsRes = await supabase.from('finance_bank_accounts').select('id, name, currency');
  const bankAccounts = bankAccountsRes.data || [];
  const bankAccMap: Record<string, { name: string; currency: string }> = {};
  for (const a of bankAccounts) bankAccMap[a.id] = { name: a.name, currency: a.currency };

  const now2 = Date.now();
  const cashAccounts = balances.map(b => {
    const staleDays = Math.floor((now2 - new Date(b.snapshot_date).getTime()) / 86400000);
    const meta = bankAccMap[b.account_id] || { name: 'Unknown', currency: 'VND' };
    return { name: meta.name, balance: b.balance, currency: meta.currency, staleDays, source: b.source };
  });
  const totalVnd = cashAccounts.reduce((s, a) => s + (a.currency === 'VND' ? a.balance : a.balance * usdToVnd), 0);
  const maxStale = cashAccounts.length ? Math.max(...cashAccounts.map(a => a.staleDays)) : null;
```

- [ ] **Step 4: Add confidence block**

After the invoices/expenses/tasks are already loaded (they're in scope from the earlier `Promise.all` destructure — need `crm_project_id` added to the two `select()` calls first):

Modify the existing invoice query (line ~156):
```ts
    supabase.from('invoice_invoices').select('id, status, currency, amount_received, items, issue_date, paid_date, created_at, crm_project_id'),
```

Modify the existing expense query (line ~157):
```ts
    supabase.from('expense_expenses').select('id, amount, currency, type, status, expense_date, source_type, crm_project_id'),
```

Modify the existing task query (line ~159):
```ts
    supabase.from('wf_tasks').select('id, status, price, currency, exchange_rate, payment_status, created_at, crm_project_id, project'),
```

Then, near the end before `return`, compute:

```ts
  const revMapped = invoices.filter((i: any) => i.crm_project_id).length;
  const costItems = [...expenses.filter((e: any) => e.type !== 'revenue'), ...tasks];
  const costMapped = costItems.filter((x: any) => x.crm_project_id).length;
```

- [ ] **Step 5: Add project profitability computation**

```ts
  const projMap: Record<string, { name: string }> = {};
  for (const p of projects) projMap[p.id] = { name: (p as any).name };

  const profitByProject: Record<string, any> = {};
  const ensureProj = (id: string) => {
    if (!profitByProject[id]) {
      profitByProject[id] = {
        projectId: id, projectName: projMap[id]?.name || 'Unknown',
        estimatedRevenue: 0, estimatedCost: 0, verifiedRevenue: 0, verifiedCost: 0,
      };
    }
    return profitByProject[id];
  };

  for (const inv of invoices) {
    const pid = (inv as any).crm_project_id;
    if (!pid) continue;
    const total = inv.amount_received ? Number(inv.amount_received) : calcInvoiceTotal(inv.items);
    const vnd = (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    const p = ensureProj(pid);
    p.estimatedRevenue += vnd;
    if (inv.status === 'paid') p.verifiedRevenue += vnd;
  }
  for (const t of tasks) {
    const pid = (t as any).crm_project_id;
    if (!pid) continue;
    const price = Number(t.price) || 0;
    const rate = Number(t.exchange_rate) || usdToVnd;
    const vnd = t.currency === 'USD' ? price * rate : price;
    const p = ensureProj(pid);
    p.estimatedCost += vnd;
    if (t.payment_status === 'paid') p.verifiedCost += vnd;
  }
  for (const e of expenses) {
    if (e.type === 'revenue') continue;
    const pid = (e as any).crm_project_id;
    if (!pid) continue;
    const vnd = (e.currency || 'VND') === 'VND' ? Number(e.amount) : Number(e.amount) * usdToVnd;
    const p = ensureProj(pid);
    p.estimatedCost += vnd;
    if (e.status === 'paid') p.verifiedCost += vnd;
  }

  const projectProfitability = Object.values(profitByProject).map((p: any) => ({
    ...p,
    estimatedProfit: p.estimatedRevenue - p.estimatedCost,
    verifiedProfit: p.verifiedRevenue - p.verifiedCost,
  }));
```

- [ ] **Step 6: Add AR/AP summary**

```ts
  // AR aging buckets — same 5-bucket scheme as ARAgingTab.tsx
  const arBucketDefs = [
    { key: 'current', label: 'Chưa đến hạn', max: 0 },
    { key: '1-30', label: '1–30 ngày', max: 30 },
    { key: '31-60', label: '31–60 ngày', max: 60 },
    { key: '61-90', label: '61–90 ngày', max: 90 },
    { key: '90+', label: 'Trên 90 ngày', max: Infinity },
  ];
  const arBucketTotals: Record<string, number> = {};
  for (const b of arBucketDefs) arBucketTotals[b.key] = 0;
  let arTotal = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid') continue;
    const total = calcInvoiceTotal(inv.items);
    const vnd = (inv.currency || 'USD') === 'VND' ? total : total * usdToVnd;
    const due = new Date((inv as any).due_date || inv.issue_date || inv.created_at);
    const dpd = Math.floor((Date.now() - due.getTime()) / 86400000);
    const bucket = dpd <= 0 ? 'current' : dpd <= 30 ? '1-30' : dpd <= 60 ? '31-60' : dpd <= 90 ? '61-90' : '90+';
    arBucketTotals[bucket] += vnd;
    arTotal += vnd;
  }

  // AP by vendor — unpaid expenses only, same shape as PayablesTab.tsx
  const apByVendor: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'revenue' || e.status === 'paid') continue;
    const vendor = (e as any).vendor?.trim() || '(Không có nhà cung cấp)';
    const vnd = (e.currency || 'VND') === 'VND' ? Number(e.amount) : Number(e.amount) * usdToVnd;
    apByVendor[vendor] = (apByVendor[vendor] || 0) + vnd;
  }
  const apTopVendors = Object.entries(apByVendor)
    .map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const apTotal = Object.values(apByVendor).reduce((s, v) => s + v, 0);
```

- [ ] **Step 7: Wire new blocks into the return statement**

Add to the `return { ... }` object (after `pipeline`, before `healthScore`):

```ts
    cashPosition: { totalVnd, accounts: cashAccounts, staleDays: maxStale },
    confidence: {
      revenue: { mapped: revMapped, total: invoices.length },
      projectCost: { mapped: costMapped, total: costItems.length },
      cashPosition: { staleDays: maxStale },
    },
    projectProfitability,
    arApSummary: {
      arTotal,
      arBuckets: arBucketDefs.map(b => ({ bucket: b.label, total: arBucketTotals[b.key] })),
      apTotal,
      apTopVendors,
    },
```

- [ ] **Step 8: Build check**

Run: `npm run build`
Expected: exit 0. Fix any TS errors from the new fields (e.g. `crm_project_id` not in a select's inferred type — cast with `as any` consistent with the rest of this file's existing style, which already uses `any` casts throughout).

- [ ] **Step 9: Manual verify via Supabase**

Run `mcp__supabase__execute_sql` with a read-only query to spot-check one project's numbers match: `SELECT id, name FROM crm_projects LIMIT 1;` then manually cross-check the corresponding `projectProfitability` entry once Task 5's UI is live (defer full check to Task 5 Step 4).

- [ ] **Step 10: Commit**

```bash
git add apps/dashboard/services/dashboardService.ts
git commit -m "feat(dashboard): cash position, confidence indicators, project profitability, AR/AP summary"
```

---

### Task 5: Dashboard panels — Bank balance, Project Profitability, AR/AP

**Files:**
- Create: `apps/dashboard/components/BankBalancePanel.tsx`
- Create: `apps/dashboard/components/ProjectProfitabilityPanel.tsx`
- Create: `apps/dashboard/components/ArApPanel.tsx`
- Modify: `apps/dashboard/components/DashboardApp.tsx`

**Interfaces:**
- Consumes: `CeoDashboardData.cashPosition`, `.confidence`, `.projectProfitability`, `.arApSummary` (all produced by Task 4).

- [ ] **Step 1: Bank balance panel**

```tsx
// apps/dashboard/components/BankBalancePanel.tsx
import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const BankBalancePanel: React.FC<{ data: CeoDashboardData['cashPosition'] }> = ({ data }) => {
  const stale = data.staleDays;
  return (
    <div className="p-5 rounded-2xl bg-surface border border-white/8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-white">💵 Tiền mặt thực tế</h3>
        {stale !== null && (
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${stale > 7 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            Cập nhật {stale === 0 ? 'hôm nay' : `${stale} ngày trước`}
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-white mb-3">{fmt(data.totalVnd)} <span className="text-xs font-normal text-neutral-medium">đ</span></p>
      <div className="space-y-1.5">
        {data.accounts.map(a => (
          <div key={a.name} className="flex justify-between text-xs">
            <span className="text-neutral-medium">{a.name}</span>
            <span className="text-white font-bold">{fmt(a.balance)} {a.currency}</span>
          </div>
        ))}
        {data.accounts.length === 0 && (
          <p className="text-neutral-medium text-xs text-center py-4">Chưa có số dư nào được nhập — vào Accounting → Số dư ngân hàng.</p>
        )}
      </div>
    </div>
  );
};

export default BankBalancePanel;
```

- [ ] **Step 2: Project profitability panel**

```tsx
// apps/dashboard/components/ProjectProfitabilityPanel.tsx
import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmtM = (n: number) => {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + ' tỷ';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'tr';
  return sign + Math.round(abs).toLocaleString('vi-VN');
};

const ProjectProfitabilityPanel: React.FC<{ data: CeoDashboardData['projectProfitability'] }> = ({ data }) => (
  <div className="p-5 rounded-2xl bg-surface border border-white/8">
    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-3">📊 Lãi/lỗ theo dự án</h3>
    {data.length === 0 ? (
      <p className="text-neutral-medium text-xs text-center py-4">Chưa có dự án nào được gán invoice/task/expense.</p>
    ) : (
      <div className="space-y-3">
        {data.map(p => (
          <div key={p.projectId} className="border-b border-white/5 pb-2 last:border-0">
            <p className="text-white font-bold text-sm mb-1">{p.projectName}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[9px] font-black uppercase text-neutral-600 tracking-wider">Tạm tính</span>
                <p className={p.estimatedProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtM(p.estimatedProfit)} đ</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-neutral-600 tracking-wider">Đã chốt</span>
                <p className={p.verifiedProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{fmtM(p.verifiedProfit)} đ</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ProjectProfitabilityPanel;
```

- [ ] **Step 3: AR/AP panel**

```tsx
// apps/dashboard/components/ArApPanel.tsx
import React from 'react';
import { CeoDashboardData } from '../services/dashboardService';

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

const ArApPanel: React.FC<{ data: CeoDashboardData['arApSummary'] }> = ({ data }) => (
  <div className="p-5 rounded-2xl bg-surface border border-white/8">
    <h3 className="text-xs font-black uppercase tracking-widest text-white mb-3">📥📤 Công nợ</h3>
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Phải thu (AR)</span>
        <a href="#invoice" className="text-primary text-[10px] font-bold hover:underline">Xem chi tiết →</a>
      </div>
      <p className="text-white font-black text-lg mb-1.5">{fmt(data.arTotal)} đ</p>
      {data.arBuckets.filter(b => b.total > 0).map(b => (
        <div key={b.bucket} className="flex justify-between text-[11px]">
          <span className="text-neutral-medium">{b.bucket}</span>
          <span className="text-white">{fmt(b.total)} đ</span>
        </div>
      ))}
    </div>
    <div className="border-t border-white/5 pt-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">Phải trả (AP)</span>
        <a href="#accounting" className="text-primary text-[10px] font-bold hover:underline">Xem chi tiết →</a>
      </div>
      <p className="text-white font-black text-lg mb-1.5">{fmt(data.apTotal)} đ</p>
      {data.apTopVendors.map(v => (
        <div key={v.vendor} className="flex justify-between text-[11px]">
          <span className="text-neutral-medium">{v.vendor}</span>
          <span className="text-white">{fmt(v.total)} đ</span>
        </div>
      ))}
    </div>
  </div>
);

export default ArApPanel;
```

- [ ] **Step 4: Wire panels into DashboardApp**

Run GitNexus `impact({target: "DashboardApp", direction: "upstream"})` — expect it's the route entrypoint, LOW risk (no other component imports it besides the router).

In `apps/dashboard/components/DashboardApp.tsx`, add imports at top:

```tsx
import BankBalancePanel from './BankBalancePanel';
import ProjectProfitabilityPanel from './ProjectProfitabilityPanel';
import ArApPanel from './ArApPanel';
```

Add a new grid section right after the existing "Section 3: Business Modules" grid (after the closing `</div>` at line 186, before "Section 4: P&L Table"):

```tsx
            {/* ══════ Section 3.5: Financial Truth ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <BankBalancePanel data={data.cashPosition} />
              <ProjectProfitabilityPanel data={data.projectProfitability} />
              <ArApPanel data={data.arApSummary} />
            </div>
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Manual verify**

Use `/verify` skill: load `#dashboard`, confirm 3 new panels render, bank balance panel shows the value entered in Task 3, project profitability shows at least one project once an invoice/task/expense is manually tagged with a `crm_project_id` (pick one existing row via `mcp__supabase__execute_sql` `UPDATE` for a smoke test, e.g. `UPDATE expense_expenses SET crm_project_id = (SELECT id FROM crm_projects LIMIT 1) WHERE id = '<one row>';`), AR/AP totals roughly match what `#invoice` → AR Aging tab and `#accounting` → Payables tab already show independently.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/BankBalancePanel.tsx apps/dashboard/components/ProjectProfitabilityPanel.tsx apps/dashboard/components/ArApPanel.tsx apps/dashboard/components/DashboardApp.tsx
git commit -m "feat(dashboard): render bank balance, project profitability, AR/AP panels"
```

---

### Task 6: Confidence badges on existing KPI cards

**Files:**
- Modify: `apps/dashboard/components/DashboardApp.tsx`

**Interfaces:**
- Consumes: `CeoDashboardData.confidence` (produced by Task 4).

- [ ] **Step 1: Add a small confidence badge helper**

In `apps/dashboard/components/DashboardApp.tsx`, add near the other small sub-components (after `MiniStat`, around line 306):

```tsx
const ConfidenceBadge: React.FC<{ mapped: number; total: number }> = ({ mapped, total }) => {
  if (total === 0) return null;
  const pct = Math.round((mapped / total) * 100);
  const color = pct >= 80 ? 'text-emerald-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`text-[9px] font-bold ${color}`}>({pct}% gán dự án)</span>;
};
```

- [ ] **Step 2: Attach badges to the revenue KPI card and profitability panel header**

In the KPI strip (Section 1, around line 81), change the "Doanh thu" `KpiCard` call to include the badge as a child — simplest is to add an optional `footer?: React.ReactNode` prop to `KpiCard`:

Modify `KpiCard` props interface (around line 203-206):

```tsx
const KpiCard: React.FC<{
  icon: string; label: string; value: string; suffix: string;
  change?: number; gradient: string; invertColor?: boolean; footer?: React.ReactNode;
}> = ({ icon, label, value, suffix, change, gradient, invertColor, footer }) => {
```

Add `{footer}` right after the existing `{hasChange && (...)}` block (around line 224), before the closing `</div>`:

```tsx
      {footer}
```

Then update the "Doanh thu" card call (line 81-82):

```tsx
              <KpiCard icon="💰" label="Doanh thu" value={fmtM(data.current.revenue)} suffix="đ"
                change={pctChange(data.current.revenue, data.prev.revenue)} gradient="from-emerald-500 to-teal-600"
                footer={<ConfidenceBadge mapped={data.confidence.revenue.mapped} total={data.confidence.revenue.total} />} />
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Manual verify**

Use `/verify` skill: confirm the "Doanh thu" KPI card shows a `(X% gán dự án)` badge, colored red/yellow/green based on how many invoices have `crm_project_id` set (expect low/red initially since no backfill happened — this is the intended signal to the CEO).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/DashboardApp.tsx
git commit -m "feat(dashboard): confidence badge on revenue KPI card"
```

---

### Task 7: Auto-refresh polling

**Files:**
- Modify: `apps/dashboard/components/DashboardApp.tsx:26-40`

**Interfaces:**
- Consumes: existing `load()` function (no signature change).

- [ ] **Step 1: Run impact analysis**

Run GitNexus `impact({target: "DashboardApp", direction: "upstream"})` (already done in Task 5 Step 4 — confirm still LOW risk, no new callers introduced since).

- [ ] **Step 2: Add polling interval**

In `apps/dashboard/components/DashboardApp.tsx`, replace:

```tsx
  useEffect(load, [selMonth, selYear]);
```

with:

```tsx
  useEffect(load, [selMonth, selYear]);

  // ponytail: 60s polling instead of Supabase Realtime — dashboard has no
  // sub-second latency requirement, and polling avoids managing 5+ realtime
  // channel subscriptions (invoice/expense/task/payroll/bank_balance) for a
  // single-viewer admin screen. Upgrade to Realtime if multiple CEOs view
  // concurrently and 60s staleness becomes noticeable.
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [selMonth, selYear]);
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Manual verify**

Use `/verify` skill: open `#dashboard`, in another tab create/edit an expense, wait up to 60s, confirm the dashboard's expense KPI updates without a manual reload. Confirm switching month/year doesn't create duplicate intervals (check no console warnings about multiple timers, and that changing month resets the polling cleanly — the `[selMonth, selYear]` dependency array handles this).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/components/DashboardApp.tsx
git commit -m "feat(dashboard): 60s auto-refresh polling"
```

---

### Task 8: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: exit 0, no warnings introduced.

- [ ] **Step 2: GitNexus regression check**

Run `detect_changes({scope: "compare", base_ref: "main"})`. Confirm the affected symbol list matches exactly what this plan touched (`fetchCeoDashboard`, `DashboardApp`, new files) — no unexpected symbols flagged.

- [ ] **Step 3: Full manual walkthrough**

Use `/verify` skill end-to-end on `http://localhost:3000`:
1. `#dashboard` loads without errors for `selMonth`/`selYear` at current month and one month with zero data (e.g. a future month) — confirm empty states render (no crashes on `data.length === 0` panels).
2. `#accounting` → new "Số dư ngân hàng" tab → add/update a balance → reflected on `#dashboard` within 60s or on manual reload.
3. `#dashboard` revenue/receivable numbers use the live VCB rate (cross-check displayed total against a manual calc with today's rate).
4. Existing `#invoice` AR Aging tab and `#accounting` Payables tab still work unchanged (this plan never modified them — regression check only).

- [ ] **Step 4: Update project memory**

Per this repo's CLAUDE.md Memory Protocol, update `.agent/meta/TASKS.md` (move this feature Doing → Done) and append a dated entry to `.agent/meta/LOG.md` describing what was built and how it was validated.

- [ ] **Step 5: Final commit**

```bash
git add .agent/meta/TASKS.md .agent/meta/LOG.md
git commit -m "docs: update project memory after dashboard financial truth layer"
```

---

## Self-Review Notes

- **Spec coverage:** hardcoded FX (Task 1) ✅, bank balance history table + confidence source (Task 2/3/4) ✅, project profitability estimated/verified (Task 4/5) ✅, AR/AP merge into dashboard (Task 4/5) ✅, confidence indicators on every block (Task 4/6 — revenue badge shown as the concrete example; `projectCost`/`cashPosition` confidence data is returned by the service in Task 4 for future badges without needing another migration) ✅, auto-refresh (Task 7) ✅.
- **Explicitly out of scope (confirmed with sếp):** double-entry ledger, auto journal entries, historical backfill of `crm_project_id` on old rows, Supabase Realtime (polling chosen instead — see Task 7 ponytail note).
- **Type consistency check:** `BankBalanceSnapshot` (Task 3) fields match `finance_bank_balance_snapshots` columns (Task 2) exactly. `CeoDashboardData.cashPosition/confidence/projectProfitability/arApSummary` (Task 4) match what `BankBalancePanel`/`ProjectProfitabilityPanel`/`ArApPanel`/`ConfidenceBadge` (Task 5/6) consume — same field names (`totalVnd`, `staleDays`, `projectId`, `estimatedProfit`, `verifiedProfit`, `arBuckets`, `apTopVendors`, `mapped`/`total`).

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-07-dashboard-financial-truth.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Sếp muốn chọn cách nào?**
