# Design Spec: Savings Deposits & Loans Module
_Date: 2026-05-28 | Project: tdgames-platforms_

## Overview

Add two new tabs to the Accounting module to let the accounting team track:
1. **Gửi tiết kiệm** (Savings Deposits) — fixed-term bank deposits with interest rate, maturity reminders, settle/renew flows
2. **Vay nợ** (Loans) — simple bank loan tracking with manual balance updates

Both flows integrate with the existing CashFlow view in the Expense module via `expense_expenses`.

---

## Requirements Summary

| Feature | Decision |
|---------|----------|
| Savings maturity flow | Settle (record actual interest) + Renew (create new record) + reminder banner ≤30 days |
| Loan repayment tracking | Simple: manual balance update per payment, no amortization schedule |
| CashFlow integration | Yes — auto-create records in `expense_expenses` on savings in/out and loan in/repayment |
| Access | Admin + ke_toan roles only (same as existing Accounting tabs) |
| Currency | VND and USD (matching existing expense system) |

---

## Architecture

### New Tabs in AccountingApp

```
Existing: 🏢 Tài sản | 💳 Tạm ứng | 📋 Công nợ | 📈 Lãi/Lỗ | 🏦 Ngân hàng | 🧾 VAT | 💼 TNCN | 🛡️ BHXH
New:      💰 Tiết kiệm | 🏧 Vay nợ
```

### New Files

```
apps/accounting/
  components/
    SavingsTab.tsx          — savings deposits UI
    LoansTab.tsx            — loans UI
  services/
    savingsService.ts       — CRUD + CashFlow sync for acc_savings
    loansService.ts         — CRUD + CashFlow sync for acc_loans
```

### Modified Files

```
apps/accounting/components/AccountingApp.tsx   — add 2 new tab imports + render cases
apps/accounting/hooks/useAccountingState.ts    — extend AccountingTab union type
types.ts                                        — add SavingsDeposit + LoanRecord interfaces
```

---

## Data Model

### `acc_savings`

```sql
CREATE TABLE acc_savings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name       text NOT NULL,
  account_number  text,
  principal       numeric NOT NULL CHECK (principal > 0),
  currency        text NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND', 'USD')),
  interest_rate   numeric NOT NULL,         -- % per year, e.g. 5.5
  term_months     int NOT NULL,             -- e.g. 3, 6, 12
  start_date      date NOT NULL,
  maturity_date   date NOT NULL,            -- computed: start_date + term_months
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'matured', 'withdrawn', 'renewed')),
  interest_earned numeric,                  -- filled in on settlement
  notes           text,
  parent_id       uuid REFERENCES acc_savings(id), -- set when renewing
  created_by      text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```

### `acc_loans`

```sql
CREATE TABLE acc_loans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_name     text NOT NULL,
  principal       numeric NOT NULL CHECK (principal > 0),
  currency        text NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND', 'USD')),
  interest_rate   numeric NOT NULL,         -- % per year
  term_months     int NOT NULL,
  start_date      date NOT NULL,
  due_date        date NOT NULL,
  outstanding     numeric NOT NULL,         -- updated manually on each payment
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paid_off', 'overdue')),
  notes           text,
  created_by      text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
```

### RLS Policies (both tables)

```sql
-- Select: admin + ke_toan
-- Insert/Update/Delete: admin + ke_toan
-- Using: (auth.jwt() ->> 'role') IN ('admin', 'ke_toan')
```

---

## CashFlow Integration

When key actions occur, the service creates a record in `expense_expenses`:

| Action | type | source_type | title example |
|--------|------|-------------|---------------|
| New savings deposit | `expense` | `savings` | "Gửi TK: Vietcombank 6T" |
| Savings settled/withdrawn | `revenue` | `savings` | "Tất toán TK: Vietcombank 6T" |
| Loan received | `revenue` | `loan` | "Vay: BIDV 12T" |
| Loan repayment | `expense` | `loan` | "Trả nợ: BIDV" |

`source_type` values `'savings'` and `'loan'` are added to the `ExpenseRecord` type union.

The existing `CashFlowView` requires no changes — it already aggregates all `expense_expenses` records.

---

## UI: SavingsTab

**List view:**
- Table columns: Ngân hàng | Số tiền | Lãi suất | Kỳ hạn | Ngày gửi | Ngày đáo hạn | Còn lại | Trạng thái | Actions
- "Còn X ngày" computed from today to maturity_date for active records
- Warning banner at top when any active record matures within 30 days

**Status badges:**
- `active` → green "Đang gửi"
- `matured` → amber "Đã đáo hạn"
- `withdrawn` → gray "Đã tất toán"
- `renewed` → blue "Đã tái tục"

**Actions per row (active only):**
- **Tất toán** — modal: enter actual interest_earned → set status = 'withdrawn', create revenue in expense_expenses
- **Tái tục** — modal: choose new term + confirm rate → set old status = 'renewed', create new acc_savings record with parent_id, create expense + revenue pair

**Form (add new):** bank_name, account_number (optional), principal, currency, interest_rate, term_months, start_date → maturity_date auto-calculated and displayed

---

## UI: LoansTab

**List view:**
- Table columns: Bên cho vay | Gốc vay | Dư nợ | Lãi suất | Kỳ hạn | Ngày vay | Đáo hạn | Trạng thái | Actions
- Warning banner when any active loan is overdue (due_date < today)

**Status badges:**
- `active` → green "Đang vay"
- `overdue` → red "Quá hạn"
- `paid_off` → gray "Đã tất toán"

**Actions per row (active only):**
- **Cập nhật dư nợ** — modal: enter amount paid → outstanding = outstanding - amount, create expense in expense_expenses; if outstanding ≤ 0 auto-set status = 'paid_off'
- **Tất toán** — direct action: set status = 'paid_off'

**Form (add new):** lender_name, principal, currency, interest_rate, term_months, start_date → due_date auto-calculated; outstanding pre-filled = principal

---

## TypeScript Types (additions to types.ts)

```typescript
export interface SavingsDeposit {
  id?: string;
  bank_name: string;
  account_number?: string;
  principal: number;
  currency: 'VND' | 'USD';
  interest_rate: number;
  term_months: number;
  start_date: string;
  maturity_date: string;
  status: 'active' | 'matured' | 'withdrawn' | 'renewed';
  interest_earned?: number | null;
  notes?: string;
  parent_id?: string | null;
  created_by: string;
  created_at?: string;
}

export interface LoanRecord {
  id?: string;
  lender_name: string;
  principal: number;
  currency: 'VND' | 'USD';
  interest_rate: number;
  term_months: number;
  start_date: string;
  due_date: string;
  outstanding: number;
  status: 'active' | 'paid_off' | 'overdue';
  notes?: string;
  created_by: string;
  created_at?: string;
}
```

`ExpenseRecord.source_type` extended: `'payroll' | 'settlement' | 'invoice' | 'manual' | 'savings' | 'loan' | null`

---

## Out of Scope

- Loan payment schedule / amortization table (can be added later)
- Email/push notifications for maturity reminders (banner only for now)
- Multi-currency principal conversion in CashFlow (uses raw amount, same as existing expenses)
- Collateral or guarantor tracking
