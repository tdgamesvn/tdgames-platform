# Accounting Phase 2 — Design Spec

_Date: 2026-05-20_  
_Status: Approved_

---

## Overview

Extend the existing `AccountingApp` (Phase 1: Fixed Assets + Advances) with 3 new modules:

1. **Payables (AP)** — vendor-aggregated view on existing Expense data
2. **P&L Report** — profitability by period, expense category, and project/client
3. **Bank Reconciliation** — import Techcombank/BIDV statements, match to invoices/expenses

**Approach:** Option A — extend AccountingApp with 3 new tabs (total 5 tabs). No new app entry in config/apps.ts. No routing changes in App.tsx.

---

## Architecture

### Tab Structure

AccountingApp tab bar redesigned to compact scrollable row (`overflow-x-auto`):

| ID | Label | Icon |
|----|-------|------|
| `assets` | Tài sản | 🏢 |
| `advances` | Tạm ứng | 💳 |
| `payables` | Công nợ | 📋 |
| `pnl` | Lãi/Lỗ | 📈 |
| `bank` | Ngân hàng | 🏦 |

### New Files

```
apps/accounting/
  components/
    PayablesTab.tsx          (new)
    PnlTab.tsx               (new)
    BankRecTab.tsx           (new)
  services/
    accountingService.ts     (extend: add bank statement CRUD)
  hooks/
    useAccountingState.ts    (extend: add payables/pnl/bank state)
types.ts                     (extend: add BankStatement type)
```

DB migration: 1 new table (`acc_bank_statements`)

---

## Module 1: Payables Tab

**Data source:** `expense_expenses` (no new table)

**UI:**
- Period filter: tháng này | quý này | tùy chọn date range
- Summary cards: Tổng phải trả | Đã thanh toán | Còn tồn đọng
- Table grouped by `vendor`:
  - Vendor name | Tổng phải trả | Đã trả | Còn nợ | Số phiếu
  - Click row → expand: list of individual expense records for that vendor

**Logic:**
- "Phải trả" (open) = `status IN ('pending', 'approved')`
- "Đã trả" (paid) = `status = 'paid'`
- Group + aggregate in-memory (data already fetched by expense app queries)
- Query: `expense_expenses` filtered by `expense_date` in selected period

---

## Module 2: P&L Tab

**Data sources:** `invoices` + `expense_expenses` (no new table)

**UI Layout:**
- Period picker: Tháng | Quý | Năm (month/year selectors)
- **Card row:** Doanh thu | Chi phí | Lợi nhuận | Margin %
- **Section A — Tổng quan theo tháng:** Monthly bar comparison (CSS bars, no chart lib)
- **Section B — Chi phí theo danh mục:** Table of expense_categories with amount + % of total
- **Section C — Theo project/client:** Revenue vs cost per project/client

**Revenue logic:**
- Source: `invoices` table
- Filter: `status = 'paid'` AND `paid_date` in period
- Currency: normalize to VND via ExchangeRateContext

**Cost logic:**
- Source: `expense_expenses`
- Filter: `status = 'paid'` AND `expense_date` in period
- Currency: normalize to VND

**Project/client matching:**
- Revenue grouped by `client_name` (from invoice `clientInfo.name`)
- Costs grouped by `client_name` + `project` fields on expense record

---

## Module 3: Bank Reconciliation Tab

### New DB Table: `acc_bank_statements`

```sql
CREATE TABLE acc_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,             -- 'techcombank' | 'bidv'
  account_number text,
  transaction_date date NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,             -- always positive
  transaction_type text NOT NULL,      -- 'debit' | 'credit'
  reference_code text,
  matched_type text,                   -- 'invoice' | 'expense' | 'advance' | null
  matched_id uuid,
  created_at timestamptz DEFAULT now()
);
-- RLS: role IN ('admin', 'ke_toan')
```

### File Parsers

**Techcombank CSV:**
```
Columns: Ngày GD | Mã GD | Mô tả | Phát sinh Nợ | Phát sinh Có | Số dư
Date format: DD/MM/YYYY
```

**BIDV Excel:**
```
Columns: STT | Ngày GD | Số tham chiếu | Mô tả | Phát sinh Nợ | Phát sinh Có | Số dư
Date format: DD/MM/YYYY
Detect: check if header row contains "Số tham chiếu" → BIDV
```

Both parsers are in a shared `parseBankFile(file: File): Promise<BankStatementRow[]>` function that auto-detects format by inspecting headers.

### Auto-match Algorithm

After import, run auto-match for each unmatched row:
1. For `credit` transactions → try matching against `invoices` (amount ±1%, date ±3 days)
2. For `debit` transactions → try matching against `expense_expenses` or `acc_advances`
3. If match found with confidence ≥ 80% → mark as `auto_matched` (shown in yellow, needs confirmation)
4. If no match → mark as `unmatched` (shown in red)

### UI Flow

1. Select bank (Techcombank / BIDV) + upload file
2. Preview parsed rows (editable before save)
3. Save to `acc_bank_statements`
4. Matching view: tabs Tất cả | Đã khớp | Chưa khớp
5. Each unmatched row: "Khớp thủ công" button → search/select from invoices or expenses
6. Summary bar: X/Y giao dịch đã khớp | Tổng Nợ | Tổng Có

---

## Types to Add (`types.ts`)

```typescript
export type BankName = 'techcombank' | 'bidv';
export type MatchType = 'invoice' | 'expense' | 'advance' | null;

export interface BankStatement {
  id: string;
  bank_name: BankName;
  account_number?: string;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  reference_code?: string;
  matched_type: MatchType;
  matched_id?: string;
  created_at: string;
}
```

---

## DB Migration

1. `acc_bank_statements` table + RLS (role admin/ke_toan)

No other schema changes needed — P&L and Payables query existing tables.

---

## Implementation Order

1. DB migration (acc_bank_statements)
2. TypeScript types (BankStatement)
3. accountingService.ts — add bank statement CRUD + parseBankFile()
4. useAccountingState.ts — extend with payables/pnl/bank state + loaders
5. PayablesTab.tsx
6. PnlTab.tsx
7. BankRecTab.tsx
8. AccountingApp.tsx — add 3 tabs, redesign tab bar
9. Build + commit + push

---

## Success Criteria

- [ ] Payables tab shows vendor aggregation with drill-down
- [ ] P&L tab shows correct revenue/cost/profit for selected period, with category + project breakdown
- [ ] Bank Rec: upload TCB and BIDV files, rows parsed correctly, auto-match finds obvious invoices
- [ ] `npm run build` passes
- [ ] RLS restricts to admin/ke_toan only
