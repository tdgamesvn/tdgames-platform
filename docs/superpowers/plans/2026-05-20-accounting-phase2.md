# Accounting Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AccountingApp with 3 new tabs — Payables (AP vendor view), P&L Report, and Bank Reconciliation (Techcombank/BIDV CSV/Excel import + matching).

**Architecture:** All 3 modules live inside the existing `AccountingApp` as new tabs. Payables and P&L read from existing `expense_expenses` and `invoice_invoices` tables (no new schema). Bank Reconciliation adds one new table `acc_bank_statements`. The `xlsx` library (already installed) handles Excel/CSV parsing.

**Tech Stack:** React 19 + TypeScript, Supabase (postgres), Tailwind CSS, xlsx ^0.18.5, ExchangeRateContext (already in app)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `types.ts` | Add `BankStatement`, `BankName`, `MatchType` types; extend `AccountingTab` |
| Modify | `apps/accounting/services/accountingService.ts` | Add bank statement CRUD + `parseBankFile()` + P&L query helpers |
| Modify | `apps/accounting/hooks/useAccountingState.ts` | Extend with payables/pnl/bank state + loaders |
| Create | `apps/accounting/components/PayablesTab.tsx` | Vendor aggregation UI |
| Create | `apps/accounting/components/PnlTab.tsx` | P&L report with period picker |
| Create | `apps/accounting/components/BankRecTab.tsx` | Bank import + match UI |
| Modify | `apps/accounting/components/AccountingApp.tsx` | Add 3 tabs, redesign compact tab bar |

---

## Task 1: DB Migration — acc_bank_statements

**Files:**
- Supabase MCP: apply migration `add_acc_bank_statements`

- [ ] **Step 1: Apply migration via Supabase MCP**

Run via `mcp__plugin_supabase_supabase__apply_migration` with project_id `fifuhkupaqcfjwyouwpa`:

```sql
CREATE TABLE IF NOT EXISTS acc_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL CHECK (bank_name IN ('techcombank', 'bidv')),
  account_number text,
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('debit', 'credit')),
  reference_code text,
  matched_type text CHECK (matched_type IN ('invoice', 'expense', 'advance')),
  matched_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE acc_bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_bank_select" ON acc_bank_statements
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ke_toan')
  );
CREATE POLICY "accounting_bank_insert" ON acc_bank_statements
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ke_toan')
  );
CREATE POLICY "accounting_bank_update" ON acc_bank_statements
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ke_toan')
  );
CREATE POLICY "accounting_bank_delete" ON acc_bank_statements
  FOR DELETE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ke_toan')
  );

CREATE INDEX idx_bank_statements_date ON acc_bank_statements (transaction_date DESC);
CREATE INDEX idx_bank_statements_matched ON acc_bank_statements (matched_type, matched_id);
```

- [ ] **Step 2: Verify table exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'acc_bank_statements' ORDER BY ordinal_position;
```

Expected: 10 rows (id, bank_name, account_number, transaction_date, description, amount, transaction_type, reference_code, matched_type, matched_id, created_at).

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types.ts` (after the `Advance` interface, around line 270+)

- [ ] **Step 1: Add BankStatement types to `types.ts`**

Append after the `Advance` interface:

```typescript
// ── Accounting — Bank Reconciliation Types ────────────────────
export type BankName = 'techcombank' | 'bidv';
export type BankMatchType = 'invoice' | 'expense' | 'advance';

export interface BankStatement {
  id: string;
  bank_name: BankName;
  account_number?: string;
  transaction_date: string;       // YYYY-MM-DD
  description: string;
  amount: number;                 // always positive
  transaction_type: 'debit' | 'credit';
  reference_code?: string;
  matched_type?: BankMatchType | null;
  matched_id?: string | null;
  created_at: string;
}

export interface BankStatementRow {
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  reference_code?: string;
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(accounting): add BankStatement TypeScript types"
```

---

## Task 3: accountingService.ts — Bank + P&L helpers

**Files:**
- Modify: `apps/accounting/services/accountingService.ts`

- [ ] **Step 1: Add imports at top of accountingService.ts**

After the existing `import { FixedAsset, Advance } from '@/types';` line, change to:

```typescript
import { supabase } from '@/services/supabaseClient';
import { FixedAsset, Advance, BankStatement, BankStatementRow, BankName } from '@/types';
import * as XLSX from 'xlsx';
```

- [ ] **Step 2: Append bank statement CRUD functions to accountingService.ts**

```typescript
// ══════════════════════════════════════════════════
// Bank Statements (Đối chiếu ngân hàng)
// ══════════════════════════════════════════════════

export async function fetchBankStatements(): Promise<BankStatement[]> {
  const { data, error } = await supabase
    .from('acc_bank_statements')
    .select('*')
    .order('transaction_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveBankStatements(
  rows: BankStatementRow[],
  bankName: BankName,
  accountNumber?: string
): Promise<BankStatement[]> {
  const records = rows.map(r => ({
    bank_name: bankName,
    account_number: accountNumber || null,
    transaction_date: r.transaction_date,
    description: r.description,
    amount: r.amount,
    transaction_type: r.transaction_type,
    reference_code: r.reference_code || null,
    matched_type: null,
    matched_id: null,
  }));
  const { data, error } = await supabase
    .from('acc_bank_statements')
    .insert(records)
    .select();
  if (error) throw error;
  return data || [];
}

export async function matchBankStatement(
  id: string,
  matchedType: 'invoice' | 'expense' | 'advance',
  matchedId: string
): Promise<void> {
  const { error } = await supabase
    .from('acc_bank_statements')
    .update({ matched_type: matchedType, matched_id: matchedId })
    .eq('id', id);
  if (error) throw error;
}

export async function unmatchBankStatement(id: string): Promise<void> {
  const { error } = await supabase
    .from('acc_bank_statements')
    .update({ matched_type: null, matched_id: null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBankStatements(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('acc_bank_statements')
    .delete()
    .in('id', ids);
  if (error) throw error;
}

// ── File Parser ───────────────────────────────────

/** Parse a Techcombank CSV or BIDV Excel file into BankStatementRow[].
 *  Auto-detects bank by inspecting the header row. */
export async function parseBankFile(file: File): Promise<{ rows: BankStatementRow[]; bank: BankName }> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row (first row with recognizable column names)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const joined = raw[i].join('|').toLowerCase();
    if (joined.includes('phát sinh') || joined.includes('mô tả') || joined.includes('ngày')) {
      headerRowIdx = i;
      break;
    }
  }

  const headers: string[] = raw[headerRowIdx].map((h: any) => String(h).trim().toLowerCase());
  const isBIDV = headers.some(h => h.includes('số tham chiếu') || h.includes('so tham chieu'));
  const bank: BankName = isBIDV ? 'bidv' : 'techcombank';

  const rows: BankStatementRow[] = [];

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every((c: any) => !c)) continue; // skip empty rows

    let dateVal: string | undefined;
    let description = '';
    let debit = 0;
    let credit = 0;
    let reference = '';

    if (bank === 'bidv') {
      // BIDV: STT | Ngày GD | Số tham chiếu | Mô tả | Phát sinh Nợ | Phát sinh Có | Số dư
      dateVal = parseDateCell(row[1]);
      reference = String(row[2] || '').trim();
      description = String(row[3] || '').trim();
      debit = parseAmount(row[4]);
      credit = parseAmount(row[5]);
    } else {
      // Techcombank: Ngày GD | Mã GD | Mô tả | Phát sinh Nợ | Phát sinh Có | Số dư
      dateVal = parseDateCell(row[0]);
      reference = String(row[1] || '').trim();
      description = String(row[2] || '').trim();
      debit = parseAmount(row[3]);
      credit = parseAmount(row[4]);
    }

    if (!dateVal || (!debit && !credit)) continue;

    if (debit > 0) {
      rows.push({ transaction_date: dateVal, description, amount: debit, transaction_type: 'debit', reference_code: reference || undefined });
    }
    if (credit > 0) {
      rows.push({ transaction_date: dateVal, description, amount: credit, transaction_type: 'credit', reference_code: reference || undefined });
    }
  }

  return { rows, bank };
}

function parseDateCell(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // DD/MM/YYYY → YYYY-MM-DD
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}

function parseAmount(val: any): number {
  if (!val && val !== 0) return 0;
  const n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : Math.abs(n);
}

// ══════════════════════════════════════════════════
// P&L Query helpers
// ══════════════════════════════════════════════════

export interface PnlPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface PnlInvoiceRow {
  id: string;
  paid_date: string;
  currency: 'USD' | 'VND';
  items: Array<{ quantity: number; unitPrice: number }>;
  tax_rate: number;
  discount_type: 'percentage' | 'amount';
  discount_value: number;
  client_name: string;
  crm_project_id?: string | null;
  amount_received?: number | null;
}

export interface PnlExpenseRow {
  id: string;
  expense_date: string;
  amount: number;
  currency: 'USD' | 'VND';
  category_id: string | null;
  client_name: string;
  project: string;
  vendor: string;
  category?: { id: string; name: string; color: string; icon: string };
}

export async function fetchPnlData(period: PnlPeriod): Promise<{ invoices: PnlInvoiceRow[]; expenses: PnlExpenseRow[] }> {
  const [invoiceRes, expenseRes] = await Promise.all([
    supabase
      .from('invoice_invoices')
      .select('id, paid_date, currency, items, tax_rate, discount_type, discount_value, client_name, crm_project_id, amount_received')
      .eq('status', 'paid')
      .gte('paid_date', period.startDate)
      .lte('paid_date', period.endDate),
    supabase
      .from('expense_expenses')
      .select('id, expense_date, amount, currency, category_id, client_name, project, vendor, category:expense_categories(id,name,color,icon)')
      .eq('status', 'paid')
      .gte('expense_date', period.startDate)
      .lte('expense_date', period.endDate),
  ]);
  if (invoiceRes.error) throw invoiceRes.error;
  if (expenseRes.error) throw expenseRes.error;
  return {
    invoices: invoiceRes.data || [],
    expenses: expenseRes.data || [],
  };
}

/** Calculate invoice total in VND */
export function calcInvoiceTotal(inv: PnlInvoiceRow, usdToVnd: number): number {
  if (inv.amount_received != null && inv.amount_received > 0) {
    return inv.currency === 'USD' ? inv.amount_received * usdToVnd : inv.amount_received;
  }
  const subtotal = (inv.items || []).reduce((s: number, item: any) => s + (item.quantity || 0) * (item.unitPrice || 0), 0);
  const discount = inv.discount_type === 'percentage'
    ? subtotal * ((inv.discount_value || 0) / 100)
    : (inv.discount_value || 0);
  const taxable = subtotal - discount;
  const total = taxable * (1 + (inv.tax_rate || 0) / 100);
  return inv.currency === 'USD' ? total * usdToVnd : total;
}

/** Calculate expense total in VND */
export function calcExpenseTotal(exp: PnlExpenseRow, usdToVnd: number): number {
  return exp.currency === 'USD' ? exp.amount * usdToVnd : exp.amount;
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/accounting/services/accountingService.ts
git commit -m "feat(accounting): add bank statement CRUD, parseBankFile, P&L query helpers"
```

---

## Task 4: useAccountingState.ts — Extend with 3 new states

**Files:**
- Modify: `apps/accounting/hooks/useAccountingState.ts`

- [ ] **Step 1: Replace full file content**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { FixedAsset, Advance, BankStatement } from '@/types';
import * as svc from '../services/accountingService';
import { setHashTab } from '@/App';

export type AccountingTab = 'assets' | 'advances' | 'payables' | 'pnl' | 'bank';
const VALID_TABS: AccountingTab[] = ['assets', 'advances', 'payables', 'pnl', 'bank'];

export function useAccountingState(currentUser: string, initialTab?: string | null) {
  const [activeTab, _setActiveTab] = useState<AccountingTab>(() => {
    if (initialTab && VALID_TABS.includes(initialTab as AccountingTab))
      return initialTab as AccountingTab;
    return 'assets';
  });

  const setActiveTab = useCallback((tab: AccountingTab) => {
    _setActiveTab(tab);
    setHashTab(tab);
  }, []);

  // ── Phase 1 state ──
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);

  // ── Phase 2 state ──
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, adv, bank] = await Promise.all([
        svc.fetchFixedAssets(),
        svc.fetchAdvances(),
        svc.fetchBankStatements(),
      ]);
      setAssets(a);
      setAdvances(adv);
      setBankStatements(bank);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Fixed Assets actions ──
  const addAsset = useCallback(async (asset: Omit<FixedAsset, 'id' | 'created_at' | 'updated_at'>) => {
    const saved = await svc.saveFixedAsset({ ...asset, created_by: currentUser });
    setAssets(prev => [saved, ...prev]);
    return saved;
  }, [currentUser]);

  const editAsset = useCallback(async (id: string, updates: Partial<FixedAsset>) => {
    await svc.updateFixedAsset(id, updates);
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const removeAsset = useCallback(async (id: string) => {
    await svc.deleteFixedAsset(id);
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Advances actions ──
  const addAdvance = useCallback(async (adv: Omit<Advance, 'id' | 'created_at' | 'updated_at'>) => {
    const saved = await svc.saveAdvance({ ...adv, created_by: currentUser });
    setAdvances(prev => [saved, ...prev]);
    return saved;
  }, [currentUser]);

  const settle = useCallback(async (
    id: string,
    payload: { settled_amount: number; returned_amount: number; settlement_date: string; settlement_notes?: string }
  ) => {
    await svc.settleAdvance(id, payload);
    setAdvances(prev => prev.map(a => a.id === id ? { ...a, ...payload, status: 'settled' as const } : a));
  }, []);

  const cancel = useCallback(async (id: string) => {
    await svc.cancelAdvance(id);
    setAdvances(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a));
  }, []);

  const removeAdvance = useCallback(async (id: string) => {
    await svc.deleteAdvance(id);
    setAdvances(prev => prev.filter(a => a.id !== id));
  }, []);

  // ── Bank Statement actions ──
  const importBankStatements = useCallback(async (
    rows: svc.BankStatementRow[],
    bankName: svc.BankName,
    accountNumber?: string
  ) => {
    const saved = await svc.saveBankStatements(rows, bankName, accountNumber);
    setBankStatements(prev => [...saved, ...prev]);
    return saved;
  }, []);

  const matchStatement = useCallback(async (
    id: string,
    matchedType: 'invoice' | 'expense' | 'advance',
    matchedId: string
  ) => {
    await svc.matchBankStatement(id, matchedType, matchedId);
    setBankStatements(prev => prev.map(s =>
      s.id === id ? { ...s, matched_type: matchedType, matched_id: matchedId } : s
    ));
  }, []);

  const unmatchStatement = useCallback(async (id: string) => {
    await svc.unmatchBankStatement(id);
    setBankStatements(prev => prev.map(s =>
      s.id === id ? { ...s, matched_type: null, matched_id: null } : s
    ));
  }, []);

  const removeBankStatements = useCallback(async (ids: string[]) => {
    await svc.deleteBankStatements(ids);
    setBankStatements(prev => prev.filter(s => !ids.includes(s.id)));
  }, []);

  // ── Summaries ──
  const openAdvancesTotal = advances
    .filter(a => a.status === 'open')
    .reduce((s, a) => s + a.amount, 0);

  const activeAssets = assets.filter(a => a.status === 'active');
  const monthlyDepTotal = svc.sumMonthlyDepreciation(activeAssets);

  const unmatchedBankCount = bankStatements.filter(s => !s.matched_type).length;

  return {
    activeTab, setActiveTab,
    assets, advances, bankStatements,
    loading, error, reload: loadAll,
    addAsset, editAsset, removeAsset,
    addAdvance, settle, cancel, removeAdvance,
    importBankStatements, matchStatement, unmatchStatement, removeBankStatements,
    openAdvancesTotal, monthlyDepTotal, activeAssets, unmatchedBankCount,
  };
}
```

Note: `BankStatementRow` and `BankName` are exported from `accountingService.ts`, so the import in this file uses `svc.BankStatementRow` and `svc.BankName`.

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/hooks/useAccountingState.ts
git commit -m "feat(accounting): extend useAccountingState with bank, payables, pnl tabs"
```

---

## Task 5: PayablesTab.tsx

**Files:**
- Create: `apps/accounting/components/PayablesTab.tsx`

- [ ] **Step 1: Create PayablesTab.tsx**

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/services/supabaseClient';
import { ExpenseRecord } from '@/types';

type Period = 'this_month' | 'this_quarter' | 'this_year' | 'custom';

function getPeriodRange(period: Period, customStart?: string, customEnd?: string): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (period === 'this_month') {
    return {
      start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (period === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: fmt(new Date(now.getFullYear(), q * 3, 1)),
      end: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)),
    };
  }
  if (period === 'this_year') {
    return {
      start: fmt(new Date(now.getFullYear(), 0, 1)),
      end: fmt(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return { start: customStart || fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: customEnd || fmt(now) };
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

interface VendorGroup {
  vendor: string;
  open: number;
  paid: number;
  count: number;
  records: ExpenseRecord[];
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const PayablesTab: React.FC<Props> = ({ onToast }) => {
  const [period, setPeriod] = useState<Period>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const range = useMemo(() => getPeriodRange(period, customStart, customEnd), [period, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('expense_expenses')
      .select('*, category:expense_categories(id,name,color,icon)')
      .gte('expense_date', range.start)
      .lte('expense_date', range.end)
      .order('expense_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) { onToast('Lỗi tải dữ liệu: ' + error.message, 'error'); return; }
        setExpenses(data || []);
        setLoading(false);
      });
  }, [range, onToast]);

  const vendorGroups: VendorGroup[] = useMemo(() => {
    const map = new Map<string, VendorGroup>();
    for (const exp of expenses) {
      const vendor = exp.vendor?.trim() || '(Chưa có nhà cung cấp)';
      if (!map.has(vendor)) map.set(vendor, { vendor, open: 0, paid: 0, count: 0, records: [] });
      const g = map.get(vendor)!;
      g.count++;
      g.records.push(exp);
      const amt = exp.amount || 0;
      if (exp.status === 'paid') g.paid += amt;
      else g.open += amt;
    }
    return Array.from(map.values()).sort((a, b) => (b.open + b.paid) - (a.open + a.paid));
  }, [expenses]);

  const totals = useMemo(() => ({
    open: vendorGroups.reduce((s, g) => s + g.open, 0),
    paid: vendorGroups.reduce((s, g) => s + g.paid, 0),
  }), [vendorGroups]);

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'this_month', label: 'Tháng này' },
    { id: 'this_quarter', label: 'Quý này' },
    { id: 'this_year', label: 'Năm này' },
    { id: 'custom', label: 'Tùy chọn' },
  ];

  const statusColor: Record<string, string> = {
    paid: '#34C759', approved: '#FF9500', pending: '#FF375F',
  };

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === p.id ? 'text-white' : 'text-neutral-400 hover:text-white bg-white/5'}`}
            style={period === p.id ? { background: '#FF9500' } : {}}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
            <span className="text-neutral-400 text-xs">→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white" />
          </>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Còn tồn đọng', value: totals.open, color: '#FF375F' },
          { label: 'Đã thanh toán', value: totals.paid, color: '#34C759' },
          { label: 'Tổng phát sinh', value: totals.open + totals.paid, color: '#FF9500' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 border border-white/5" style={{ background: '#1A1A1A' }}>
            <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className="text-xl font-black" style={{ color: c.color }}>{fmt(c.value)} ₫</p>
          </div>
        ))}
      </div>

      {/* Vendor table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : vendorGroups.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">Không có dữ liệu trong kỳ này</div>
      ) : (
        <div className="space-y-2">
          {vendorGroups.map(g => (
            <div key={g.vendor} className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: '#1A1A1A' }}>
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-all text-left"
                onClick={() => setExpandedVendor(expandedVendor === g.vendor ? null : g.vendor)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">{g.vendor}</span>
                  <span className="text-xs text-neutral-500">{g.count} phiếu</span>
                </div>
                <div className="flex items-center gap-6">
                  {g.open > 0 && <div className="text-right">
                    <p className="text-xs text-neutral-500">Còn nợ</p>
                    <p className="text-sm font-bold" style={{ color: '#FF375F' }}>{fmt(g.open)} ₫</p>
                  </div>}
                  {g.paid > 0 && <div className="text-right">
                    <p className="text-xs text-neutral-500">Đã trả</p>
                    <p className="text-sm font-bold" style={{ color: '#34C759' }}>{fmt(g.paid)} ₫</p>
                  </div>}
                  <svg className={`w-4 h-4 text-neutral-400 transition-transform ${expandedVendor === g.vendor ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedVendor === g.vendor && (
                <div className="border-t border-white/5 px-5 pb-4">
                  <table className="w-full mt-3 text-xs">
                    <thead>
                      <tr className="text-neutral-500 uppercase tracking-wider">
                        <th className="text-left pb-2">Ngày</th>
                        <th className="text-left pb-2">Mô tả</th>
                        <th className="text-left pb-2">Danh mục</th>
                        <th className="text-right pb-2">Số tiền</th>
                        <th className="text-right pb-2">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.records.map(r => (
                        <tr key={r.id} className="border-t border-white/5">
                          <td className="py-2 text-neutral-400">{r.expense_date}</td>
                          <td className="py-2 text-white">{r.title}</td>
                          <td className="py-2 text-neutral-400">{(r as any).category?.name || '—'}</td>
                          <td className="py-2 text-right text-white font-bold">{fmt(r.amount)} {r.currency}</td>
                          <td className="py-2 text-right">
                            <span className="px-2 py-0.5 rounded-full text-white text-xs font-bold"
                              style={{ background: statusColor[r.status] || '#666' }}>
                              {r.status === 'paid' ? 'Đã trả' : r.status === 'approved' ? 'Duyệt' : 'Chờ'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayablesTab;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/components/PayablesTab.tsx
git commit -m "feat(accounting): add PayablesTab — vendor aggregation with drill-down"
```

---

## Task 6: PnlTab.tsx

**Files:**
- Create: `apps/accounting/components/PnlTab.tsx`

- [ ] **Step 1: Create PnlTab.tsx**

```typescript
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useExchangeRate } from '@/services/ExchangeRateContext';
import * as svc from '../services/accountingService';

type ViewMode = 'month' | 'quarter' | 'year';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));
const pct = (n: number) => (isFinite(n) ? n.toFixed(1) : '0.0');

function getPeriodRange(mode: ViewMode, year: number, sub: number): { startDate: string; endDate: string; label: string } {
  if (mode === 'month') {
    const start = new Date(year, sub, 1);
    const end = new Date(year, sub + 1, 0);
    const label = start.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0], label };
  }
  if (mode === 'quarter') {
    const startMonth = sub * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0], label: `Q${sub + 1}/${year}` };
  }
  // year
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, label: `Năm ${year}` };
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const PnlTab: React.FC<Props> = ({ onToast }) => {
  const { avgUsdVnd } = useExchangeRate();
  const now = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [sub, setSub] = useState(now.getMonth()); // month index or quarter index

  const [invoices, setInvoices] = useState<svc.PnlInvoiceRow[]>([]);
  const [expenses, setExpenses] = useState<svc.PnlExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const period = useMemo(() => getPeriodRange(viewMode, year, sub), [viewMode, year, sub]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await svc.fetchPnlData({ startDate: period.startDate, endDate: period.endDate });
      setInvoices(data.invoices);
      setExpenses(data.expenses);
    } catch (e: any) {
      onToast('Lỗi tải dữ liệu: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [period, onToast]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = useMemo(() =>
    invoices.reduce((s, inv) => s + svc.calcInvoiceTotal(inv, avgUsdVnd), 0),
    [invoices, avgUsdVnd]
  );
  const totalCost = useMemo(() =>
    expenses.reduce((s, exp) => s + svc.calcExpenseTotal(exp, avgUsdVnd), 0),
    [expenses, avgUsdVnd]
  );
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  // By category
  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string; total: number }>();
    for (const exp of expenses) {
      const cat = (exp as any).category;
      const key = cat?.id || 'uncategorized';
      if (!map.has(key)) map.set(key, { name: cat?.name || 'Chưa phân loại', color: cat?.color || '#666', icon: cat?.icon || '📦', total: 0 });
      map.get(key)!.total += svc.calcExpenseTotal(exp, avgUsdVnd);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [expenses, avgUsdVnd]);

  // By client/project
  const byClient = useMemo(() => {
    const map = new Map<string, { client: string; revenue: number; cost: number }>();
    for (const inv of invoices) {
      const key = inv.client_name || 'Khách hàng khác';
      if (!map.has(key)) map.set(key, { client: key, revenue: 0, cost: 0 });
      map.get(key)!.revenue += svc.calcInvoiceTotal(inv, avgUsdVnd);
    }
    for (const exp of expenses) {
      const key = exp.client_name?.trim() || exp.project?.trim() || 'Chi phí chung';
      if (!map.has(key)) map.set(key, { client: key, revenue: 0, cost: 0 });
      map.get(key)!.cost += svc.calcExpenseTotal(exp, avgUsdVnd);
    }
    return Array.from(map.values()).sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost));
  }, [invoices, expenses, avgUsdVnd]);

  const MONTHS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

  const navigate = (dir: number) => {
    if (viewMode === 'month') {
      let m = sub + dir; let y = year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      setSub(m); setYear(y);
    } else if (viewMode === 'quarter') {
      let q = sub + dir; let y = year;
      if (q < 0) { q = 3; y--; }
      if (q > 3) { q = 0; y++; }
      setSub(q); setYear(y);
    } else {
      setYear(y => y + dir);
    }
  };

  const profitColor = profit >= 0 ? '#34C759' : '#FF375F';

  return (
    <div className="space-y-6">
      {/* Period controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1">
          {(['month','quarter','year'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => { setViewMode(m); setSub(m === 'quarter' ? Math.floor(now.getMonth()/3) : now.getMonth()); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === m ? 'text-white' : 'text-neutral-400 hover:text-white bg-white/5'}`}
              style={viewMode === m ? { background: '#FF9500' } : {}}>
              {m === 'month' ? 'Tháng' : m === 'quarter' ? 'Quý' : 'Năm'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white font-bold text-sm min-w-[120px] text-center">{period.label}</span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {viewMode === 'month' && (
          <div className="flex gap-1 flex-wrap">
            {MONTHS.map((m, i) => (
              <button key={i} onClick={() => setSub(i)}
                className={`px-2 py-1 rounded text-xs font-bold transition-all ${sub === i && year === now.getFullYear() ? 'text-white' : 'text-neutral-500 hover:text-white'}`}
                style={sub === i ? { color: '#FF9500' } : {}}>
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Doanh thu', value: totalRevenue, color: '#34C759' },
              { label: 'Chi phí', value: totalCost, color: '#FF375F' },
              { label: 'Lợi nhuận', value: profit, color: profitColor },
              { label: 'Margin', value: null, text: `${pct(margin)}%`, color: profitColor },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 border border-white/5" style={{ background: '#1A1A1A' }}>
                <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">{c.label}</p>
                <p className="text-xl font-black" style={{ color: c.color }}>
                  {c.text ?? `${fmt(c.value!)} ₫`}
                </p>
              </div>
            ))}
          </div>

          {/* Revenue vs Cost bar */}
          {(totalRevenue > 0 || totalCost > 0) && (
            <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1A1A1A' }}>
              <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">Tổng quan</p>
              {[
                { label: 'Doanh thu', value: totalRevenue, color: '#34C759', max: Math.max(totalRevenue, totalCost) },
                { label: 'Chi phí', value: totalCost, color: '#FF375F', max: Math.max(totalRevenue, totalCost) },
              ].map(b => (
                <div key={b.label} className="mb-3">
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span>{b.label}</span><span>{fmt(b.value)} ₫</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${b.max ? (b.value / b.max) * 100 : 0}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* By Category */}
          {byCategory.length > 0 && (
            <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1A1A1A' }}>
              <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">Chi phí theo danh mục</p>
              <div className="space-y-2">
                {byCategory.map(cat => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-lg w-6 text-center">{cat.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white font-medium">{cat.name}</span>
                        <span className="text-neutral-400">{totalCost > 0 ? pct((cat.total / totalCost) * 100) : '0'}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div className="h-1.5 rounded-full" style={{ width: `${totalCost > 0 ? (cat.total / totalCost) * 100 : 0}%`, background: cat.color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white min-w-[110px] text-right">{fmt(cat.total)} ₫</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Client/Project */}
          {byClient.length > 0 && (
            <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1A1A1A' }}>
              <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">Theo khách hàng / dự án</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-neutral-500 uppercase tracking-wider">
                    <th className="text-left pb-2">Khách hàng / Dự án</th>
                    <th className="text-right pb-2">Doanh thu</th>
                    <th className="text-right pb-2">Chi phí</th>
                    <th className="text-right pb-2">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {byClient.map(c => {
                    const p = c.revenue - c.cost;
                    return (
                      <tr key={c.client} className="border-t border-white/5">
                        <td className="py-2 text-white font-medium">{c.client}</td>
                        <td className="py-2 text-right" style={{ color: '#34C759' }}>{fmt(c.revenue)} ₫</td>
                        <td className="py-2 text-right" style={{ color: '#FF375F' }}>{fmt(c.cost)} ₫</td>
                        <td className="py-2 text-right font-bold" style={{ color: p >= 0 ? '#34C759' : '#FF375F' }}>
                          {p >= 0 ? '+' : ''}{fmt(p)} ₫
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {invoices.length === 0 && expenses.length === 0 && (
            <div className="text-center py-20 text-neutral-500">Không có dữ liệu trong kỳ này</div>
          )}
        </>
      )}
    </div>
  );
};

export default PnlTab;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/components/PnlTab.tsx
git commit -m "feat(accounting): add PnlTab — P&L by period, category, and client"
```

---

## Task 7: BankRecTab.tsx

**Files:**
- Create: `apps/accounting/components/BankRecTab.tsx`

- [ ] **Step 1: Create BankRecTab.tsx**

```typescript
import React, { useState, useMemo, useCallback } from 'react';
import { BankStatement } from '@/types';
import * as svc from '../services/accountingService';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n));

type FilterTab = 'all' | 'matched' | 'unmatched';

interface Props {
  bankStatements: BankStatement[];
  onImport: (rows: svc.BankStatementRow[], bank: svc.BankName, accountNumber?: string) => Promise<BankStatement[]>;
  onMatch: (id: string, type: 'invoice' | 'expense' | 'advance', matchedId: string) => Promise<void>;
  onUnmatch: (id: string) => Promise<void>;
  onDelete: (ids: string[]) => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const BankRecTab: React.FC<Props> = ({ bankStatements, onImport, onMatch, onUnmatch, onDelete, onToast }) => {
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [importing, setImporting] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { rows, bank } = await svc.parseBankFile(file);
      if (rows.length === 0) { onToast('Không tìm thấy giao dịch trong file', 'error'); return; }
      await onImport(rows, bank, accountNumber || undefined);
      onToast(`✅ Import ${rows.length} giao dịch từ ${bank === 'bidv' ? 'BIDV' : 'Techcombank'}`);
    } catch (err: any) {
      onToast('Lỗi import: ' + err.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }, [onImport, accountNumber, onToast]);

  const filtered = useMemo(() => {
    let list = bankStatements;
    if (filterTab === 'matched') list = list.filter(s => s.matched_type);
    if (filterTab === 'unmatched') list = list.filter(s => !s.matched_type);
    return list;
  }, [bankStatements, filterTab]);

  const totals = useMemo(() => ({
    debit: bankStatements.filter(s => s.transaction_type === 'debit').reduce((sum, s) => sum + s.amount, 0),
    credit: bankStatements.filter(s => s.transaction_type === 'credit').reduce((sum, s) => sum + s.amount, 0),
    matched: bankStatements.filter(s => s.matched_type).length,
    total: bankStatements.length,
  }), [bankStatements]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      onToast(`Đã xóa ${selectedIds.size} giao dịch`);
    } catch (err: any) {
      onToast('Lỗi xóa: ' + err.message, 'error');
    }
  };

  const matchTypeLabel: Record<string, string> = {
    invoice: '📄 Hoá đơn', expense: '💰 Chi phí', advance: '💳 Tạm ứng',
  };

  const FILTER_TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `Tất cả (${totals.total})` },
    { id: 'matched', label: `Đã khớp (${totals.matched})` },
    { id: 'unmatched', label: `Chưa khớp (${totals.total - totals.matched})` },
  ];

  return (
    <div className="space-y-6">
      {/* Import controls */}
      <div className="rounded-2xl p-5 border border-white/5" style={{ background: '#1A1A1A' }}>
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-4">Import sao kê ngân hàng</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Số tài khoản (tuỳ chọn)</label>
            <input
              type="text"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value)}
              placeholder="VD: 19036XXXXXXX"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 w-52"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">File sao kê (Techcombank CSV / BIDV Excel)</label>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${importing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{ background: '#FF9500', color: 'white' }}>
              {importing ? '⏳ Đang import...' : '📂 Chọn file'}
              <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleFileUpload} disabled={importing} />
            </label>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-3">Hỗ trợ: Techcombank (.csv) · BIDV (.xlsx, .xls) — tự động nhận dạng ngân hàng</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng GD', value: totals.total, text: `${totals.total} GD`, color: '#FF9500' },
          { label: 'Đã khớp', value: totals.matched, text: `${totals.matched}/${totals.total}`, color: '#34C759' },
          { label: 'Tổng Có (thu)', value: totals.credit, text: `${fmt(totals.credit)} ₫`, color: '#34C759' },
          { label: 'Tổng Nợ (chi)', value: totals.debit, text: `${fmt(totals.debit)} ₫`, color: '#FF375F' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4 border border-white/5" style={{ background: '#1A1A1A' }}>
            <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">{c.label}</p>
            <p className="text-lg font-black" style={{ color: c.color }}>{c.text}</p>
          </div>
        ))}
      </div>

      {/* Filter + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {FILTER_TABS.map(t => (
            <button key={t.id} onClick={() => setFilterTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterTab === t.id ? 'text-white' : 'text-neutral-400 hover:text-white bg-white/5'}`}
              style={filterTab === t.id ? { background: '#FF9500' } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <button onClick={handleDeleteSelected}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 transition-all">
            🗑 Xóa {selectedIds.size} GD đã chọn
          </button>
        )}
      </div>

      {/* Transactions list */}
      {bankStatements.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">Chưa có dữ liệu — import file sao kê để bắt đầu</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-neutral-500">Không có giao dịch trong bộ lọc này</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(stmt => (
            <div key={stmt.id}
              className={`rounded-2xl px-5 py-4 border transition-all flex items-center gap-4 ${selectedIds.has(stmt.id) ? 'border-orange-400/40' : 'border-white/5'}`}
              style={{ background: '#1A1A1A' }}>
              <input type="checkbox" checked={selectedIds.has(stmt.id)} onChange={() => toggleSelect(stmt.id)}
                className="accent-orange-400 w-4 h-4 cursor-pointer" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${stmt.transaction_type === 'credit' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                    {stmt.transaction_type === 'credit' ? 'Có' : 'Nợ'}
                  </span>
                  <span className="text-xs text-neutral-500">{stmt.transaction_date}</span>
                  <span className="text-xs text-neutral-600">{stmt.bank_name === 'bidv' ? 'BIDV' : 'TCB'}</span>
                  {stmt.reference_code && <span className="text-xs text-neutral-600">#{stmt.reference_code}</span>}
                </div>
                <p className="text-sm text-white truncate">{stmt.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black" style={{ color: stmt.transaction_type === 'credit' ? '#34C759' : '#FF375F' }}>
                  {stmt.transaction_type === 'credit' ? '+' : '-'}{fmt(stmt.amount)} ₫
                </p>
                {stmt.matched_type ? (
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <span className="text-xs text-green-400">{matchTypeLabel[stmt.matched_type]}</span>
                    <button onClick={() => onUnmatch(stmt.id)}
                      className="text-xs text-neutral-500 hover:text-red-400 transition-all ml-1" title="Bỏ khớp">✕</button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500 mt-1 block">Chưa khớp</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankRecTab;
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/components/BankRecTab.tsx
git commit -m "feat(accounting): add BankRecTab — import TCB/BIDV, match/unmatch transactions"
```

---

## Task 8: AccountingApp.tsx — Add 3 tabs, redesign tab bar

**Files:**
- Modify: `apps/accounting/components/AccountingApp.tsx`

- [ ] **Step 1: Replace full file content**

```typescript
import React, { useState } from 'react';
import { AccountUser } from '@/types';
import { useAccountingState } from '../hooks/useAccountingState';
import FixedAssetTab from './FixedAssetTab';
import AdvanceTab from './AdvanceTab';
import PayablesTab from './PayablesTab';
import PnlTab from './PnlTab';
import BankRecTab from './BankRecTab';

interface Props {
  currentUser: AccountUser;
  onBack: () => void;
  initialTab?: string | null;
}

const TABS = [
  { id: 'assets'    as const, label: 'Tài sản',   icon: '🏢' },
  { id: 'advances'  as const, label: 'Tạm ứng',   icon: '💳' },
  { id: 'payables'  as const, label: 'Công nợ',   icon: '📋' },
  { id: 'pnl'       as const, label: 'Lãi/Lỗ',    icon: '📈' },
  { id: 'bank'      as const, label: 'Ngân hàng',  icon: '🏦' },
];

const AccountingApp: React.FC<Props> = ({ currentUser, onBack, initialTab }) => {
  const state = useAccountingState(currentUser.username, initialTab);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-white/5" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={onBack} className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-all shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🧾</span>
            <span className="text-white font-black uppercase tracking-widest text-sm">Kế toán</span>
          </div>
          {/* Scrollable tab bar */}
          <div className="flex gap-1 ml-2 overflow-x-auto scrollbar-none">
            {TABS.map(t => (
              <button key={t.id} onClick={() => state.setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all shrink-0 ${state.activeTab === t.id ? 'text-white' : 'text-neutral-400 hover:text-white hover:bg-white/5'}`}
                style={state.activeTab === t.id ? { background: '#FF9500' } : {}}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {state.loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : state.error ? (
          <div className="text-center py-20 text-red-400">{state.error}</div>
        ) : (
          <>
            {state.activeTab === 'assets' && (
              <FixedAssetTab
                assets={state.assets}
                onAdd={state.addAsset}
                onEdit={state.editAsset}
                onDelete={state.removeAsset}
                onToast={showToast}
              />
            )}
            {state.activeTab === 'advances' && (
              <AdvanceTab
                advances={state.advances}
                openTotal={state.openAdvancesTotal}
                onAdd={state.addAdvance}
                onSettle={state.settle}
                onCancel={state.cancel}
                onDelete={state.removeAdvance}
                onToast={showToast}
              />
            )}
            {state.activeTab === 'payables' && (
              <PayablesTab onToast={showToast} />
            )}
            {state.activeTab === 'pnl' && (
              <PnlTab onToast={showToast} />
            )}
            {state.activeTab === 'bank' && (
              <BankRecTab
                bankStatements={state.bankStatements}
                onImport={state.importBankStatements}
                onMatch={state.matchStatement}
                onUnmatch={state.unmatchStatement}
                onDelete={state.removeBankStatements}
                onToast={showToast}
              />
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-xl transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AccountingApp;
```

- [ ] **Step 2: Verify full build**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no TypeScript or import errors.

- [ ] **Step 3: Commit**

```bash
git add apps/accounting/components/AccountingApp.tsx
git commit -m "feat(accounting): wire up 5-tab layout with Payables, P&L, BankRec tabs"
```

---

## Task 9: Final verification and push

- [ ] **Step 1: Run full build one more time**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -10
```

Expected: zero errors, bundle size output.

- [ ] **Step 2: Check ExchangeRateContext export**

The `PnlTab` uses `useExchangeRate()`. Verify it's exported from `services/ExchangeRateContext.tsx`:

```bash
grep "export.*useExchangeRate" /Users/tdgames_mac01/Work/apps/tdgames-platforms/services/ExchangeRateContext.tsx
```

Expected: `export const useExchangeRate` or `export function useExchangeRate`. If missing, add to `services/ExchangeRateContext.tsx`:

```typescript
export const useExchangeRate = (): ExchangeRateContextValue => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useExchangeRate must be used within ExchangeRateProvider');
  return ctx;
};
```

- [ ] **Step 3: Re-run build if ExchangeRateContext was modified**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Push to main → auto-deploy**

```bash
git push origin main
```

Expected: GitHub Actions triggers, deploys in ~22s to `https://app.tdgamestudio.com`.

- [ ] **Step 5: Smoke test on prod**
  - Open AccountingApp → verify 5 tabs visible in scrollable bar
  - Payables tab → verify vendor table loads
  - P&L tab → verify period picker and cards render
  - Bank tab → verify import button and upload controls visible

---

## Self-Review Checklist

- [x] **Task 1** covers `acc_bank_statements` migration + RLS ✓
- [x] **Task 2** covers `BankStatement`, `BankName`, `BankStatementRow` types ✓
- [x] **Task 3** covers all bank CRUD, `parseBankFile` (TCB + BIDV), `fetchPnlData`, `calcInvoiceTotal`, `calcExpenseTotal` ✓
- [x] **Task 4** extends hook with `bankStatements`, `importBankStatements`, `matchStatement`, `unmatchStatement`, `removeBankStatements` ✓
- [x] **Task 5** covers PayablesTab — period filter, vendor groups, drill-down ✓
- [x] **Task 6** covers PnlTab — mode picker, summary cards, bars, by-category, by-client ✓
- [x] **Task 7** covers BankRecTab — file upload, list, filter, match/unmatch, delete ✓
- [x] **Task 8** covers AccountingApp redesign with 5-tab scrollable bar ✓
- [x] **Task 9** covers ExchangeRateContext hook export check + push ✓
- [x] Type names consistent across all tasks: `BankStatement`, `BankStatementRow`, `BankName`, `svc.BankName` in hook ✓
- [x] `useExchangeRate` — checked in Task 9 before assuming it exists ✓
