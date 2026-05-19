# Multi-Bank / Multi-Entity Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hỗ trợ 2 pháp nhân (TD GAMES + TD CONSULTING) và 1 luồng thu nhập cá nhân trong hệ thống kế toán — mỗi hoá đơn biết rõ entity phát hành và tài khoản ngân hàng nhận tiền.

**Architecture:**
- Tạo bảng `finance_bank_accounts` làm master danh sách tài khoản (6 tài khoản).
- Thêm `billing_entity TEXT` và `receiving_account_id UUID` vào `invoice_invoices`.
- Cập nhật `CashFlowView` để hiển thị 3 luồng riêng biệt; luồng thu nhập cá nhân chỉ hiện với role `admin` / `ke_toan`.

**Tech Stack:** React 19 + TypeScript, Supabase (PostgreSQL + RLS), Vite SPA

---

## Task 1: DB Migration — Tạo bảng `finance_bank_accounts`

**Files:**
- Supabase migration (apply via MCP `apply_migration`)

- [ ] **Step 1: Apply migration tạo bảng**

```sql
CREATE TABLE finance_bank_accounts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,          -- "BIDV VND - Công ty"
  bank_name    TEXT        NOT NULL,          -- "BIDV" / "Techcombank"
  account_number TEXT,
  currency     TEXT        NOT NULL DEFAULT 'VND',
  account_type TEXT        NOT NULL DEFAULT 'company', -- 'company' | 'personal'
  entity       TEXT        NOT NULL DEFAULT 'TD GAMES', -- 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân'
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE finance_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read" ON finance_bank_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin write" ON finance_bank_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoice_accounts
      WHERE username = auth.jwt() ->> 'sub'
        AND role IN ('admin', 'ke_toan')
    )
  );
```

- [ ] **Step 2: Seed 6 tài khoản ngân hàng**

```sql
INSERT INTO finance_bank_accounts (name, bank_name, account_number, currency, account_type, entity, sort_order) VALUES
  ('BIDV VND – Công ty',     'BIDV',        '31410000000000', 'VND', 'company',  'TD GAMES',       1),
  ('BIDV USD – Công ty',     'BIDV',        '31411000000000', 'USD', 'company',  'TD GAMES',       2),
  ('TCB VND – Công ty',      'Techcombank', '19038000000000', 'VND', 'company',  'TD GAMES',       3),
  ('TCB USD – Công ty',      'Techcombank', '19038000000001', 'USD', 'company',  'TD GAMES',       4),
  ('TCB VND – Cá nhân',      'Techcombank', '19037000000000', 'VND', 'personal', 'Cá nhân',        5),
  ('BIDV USD – TD Consulting','BIDV',       '31412000000000', 'USD', 'company',  'TD CONSULTING',  6);
```

> **Lưu ý:** Thay account_number bằng số thật nếu cần — đây là placeholder.

---

## Task 2: DB Migration — Thêm cột vào `invoice_invoices`

**Files:**
- Supabase migration (apply via MCP `apply_migration`)
- `apps/invoice/services/invoiceService.ts` — nếu có, thêm 2 field mới vào type/select

- [ ] **Step 1: Apply migration thêm cột**

```sql
ALTER TABLE invoice_invoices
  ADD COLUMN IF NOT EXISTS billing_entity       TEXT DEFAULT 'TD GAMES',
  ADD COLUMN IF NOT EXISTS receiving_account_id UUID REFERENCES finance_bank_accounts(id);
```

- [ ] **Step 2: Cập nhật 8 invoice hiện tại**

Sau khi biết UUID của từng tài khoản (query `SELECT id, name FROM finance_bank_accounts ORDER BY sort_order`):

```sql
-- Ví dụ: set TD GAMES invoice → nhận vào TCB VND hoặc BIDV VND
-- Thay <uuid_tcb_vnd_company> bằng UUID thực
UPDATE invoice_invoices
  SET billing_entity = 'TD GAMES',
      receiving_account_id = '<uuid_bidv_vnd_company>'
WHERE billing_entity IS NULL OR billing_entity = 'TD GAMES';
```

Chạy query để lấy UUID thực trước khi update:
```sql
SELECT id, name, entity FROM finance_bank_accounts ORDER BY sort_order;
```

---

## Task 3: Service — `bankAccountService.ts`

**Files:**
- Create: `apps/expense/services/bankAccountService.ts`

- [ ] **Step 1: Tạo service file**

```typescript
// apps/expense/services/bankAccountService.ts
import { supabase } from '@/services/supabaseClient';

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  currency: string;
  account_type: 'company' | 'personal';
  entity: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân';
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('finance_bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}
```

---

## Task 4: UI — Thêm `billing_entity` + `receiving_account_id` vào Invoice Editor

**Files:**
- Modify: `apps/invoice/components/InvoiceEditor.tsx` — thêm 2 dropdown trong sidebar
- Modify: `apps/invoice/components/InvoiceApp.tsx` — fetch `finance_bank_accounts`, pass vào editor
- Modify: `types/index.ts` — thêm 2 field vào `InvoiceData`

- [ ] **Step 1: Thêm vào `InvoiceData` type**

Tìm `interface InvoiceData` trong `types/index.ts`, thêm:
```typescript
billing_entity?: 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân';
receiving_account_id?: string | null;
```

- [ ] **Step 2: Fetch bank accounts trong `InvoiceApp.tsx`**

Tìm chỗ fetch studios/banks trong `InvoiceApp.tsx`, thêm:
```typescript
import { fetchBankAccounts, BankAccount } from '@/apps/expense/services/bankAccountService';

// Trong state:
const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

// Trong useEffect khởi tạo:
fetchBankAccounts().then(setBankAccounts).catch(console.error);
```

Pass `bankAccounts` vào `<InvoiceEditor bankAccounts={bankAccounts} ... />`

- [ ] **Step 3: Thêm props vào `InvoiceEditorProps`**

```typescript
bankAccounts: BankAccount[];
```

- [ ] **Step 4: Thêm UI dropdown trong sidebar `InvoiceEditor.tsx`**

Trong section Actions (sau chỗ chọn bank / studio hiện tại), thêm:

```tsx
{/* ── Pháp nhân & tài khoản nhận tiền ── */}
<div className="space-y-3 pt-4 border-t border-white/5">
  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-medium">Pháp nhân phát hành</h3>
  <Select
    value={invoice.billing_entity || 'TD GAMES'}
    onChange={e => updateInvoice('billing_entity', e.target.value)}
    theme={invoice.theme}
  >
    <option value="TD GAMES">TD GAMES</option>
    <option value="TD CONSULTING">TD CONSULTING</option>
    <option value="Cá nhân">Cá nhân (không xuất HĐ)</option>
  </Select>

  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-medium mt-2">TK ngân hàng nhận</h3>
  <Select
    value={invoice.receiving_account_id || ''}
    onChange={e => updateInvoice('receiving_account_id', e.target.value || null)}
    theme={invoice.theme}
  >
    <option value="">— Chưa chọn —</option>
    {bankAccounts
      .filter(a => {
        if (invoice.billing_entity === 'Cá nhân') return a.account_type === 'personal';
        return a.entity === (invoice.billing_entity || 'TD GAMES');
      })
      .map(a => (
        <option key={a.id} value={a.id}>
          {a.name} ({a.currency})
        </option>
      ))
    }
  </Select>
</div>
```

- [ ] **Step 5: Đảm bảo `onSaveToCloud` lưu 2 field mới**

Trong `InvoiceApp.tsx` tìm hàm `onSaveToCloud` / upsert invoice:
```typescript
// 2 field mới tự động có trong `invoice` object nếu InvoiceData đã khai báo
billing_entity: invoice.billing_entity || 'TD GAMES',
receiving_account_id: invoice.receiving_account_id || null,
```

---

## Task 5: Nâng cấp `CashFlowView` — 3 luồng dòng tiền

**Files:**
- Modify: `apps/expense/components/CashFlowView.tsx`

**Logic:**
- Luồng 1 — TD GAMES Official: `billing_entity = 'TD GAMES'`
- Luồng 2 — TD CONSULTING: `billing_entity = 'TD CONSULTING'`  
- Luồng 3 — Cá nhân: `billing_entity = 'Cá nhân'` — **chỉ hiện nếu `currentUserRole` là `admin` hoặc `ke_toan`**

- [ ] **Step 1: Cập nhật `PaidInvoice` interface và query**

```typescript
interface PaidInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  paid_date: string;
  currency: string;
  items: { quantity: number; unitPrice: number }[];
  billing_entity: string | null;  // NEW
}
```

Query thêm field:
```typescript
.select('id, invoice_number, client_name, paid_date, currency, items, billing_entity')
```

- [ ] **Step 2: Thêm `currentUserRole` prop**

```typescript
interface Props {
  expenses: ExpenseRecord[];
  vcbAvgRate: number;
  currentUserRole: string;  // NEW — để kiểm tra quyền xem Luồng 3
}
```

Trong `ExpenseApp.tsx` nơi render `<CashFlowView>`, thêm:
```tsx
<CashFlowView
  expenses={state.expenses}
  vcbAvgRate={avgUsdVnd}
  currentUserRole={currentUser.role}
/>
```

- [ ] **Step 3: Thêm `stream` state và filter logic**

```typescript
type Stream = 'TD GAMES' | 'TD CONSULTING' | 'Cá nhân' | 'all';
const [stream, setStream] = useState<Stream>('TD GAMES');

const canSeePersonal = currentUserRole === 'admin' || currentUserRole === 'ke_toan';
```

- [ ] **Step 4: Tính `monthData` theo `stream` hiện tại**

Thay vì tính tổng tất cả invoices, filter theo entity:

```typescript
const filteredInvoices = useMemo(() =>
  paidInvoices.filter(inv => {
    const entity = inv.billing_entity || 'TD GAMES';
    if (stream === 'all') {
      if (entity === 'Cá nhân' && !canSeePersonal) return false;
      return true;
    }
    return entity === stream;
  }),
  [paidInvoices, stream, canSeePersonal]
);
```

Sau đó dùng `filteredInvoices` thay `paidInvoices` trong `useMemo` tính `monthData`.

- [ ] **Step 5: Thêm Stream Selector UI**

Render tabs trên cùng CashFlowView (trước year selector):

```tsx
<div className="flex items-center gap-2 flex-wrap">
  {(['TD GAMES', 'TD CONSULTING', ...(canSeePersonal ? ['Cá nhân'] : [])] as Stream[]).map(s => (
    <button
      key={s}
      onClick={() => setStream(s)}
      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
        stream === s
          ? s === 'Cá nhân'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'bg-primary/20 text-primary border border-primary/30'
          : 'text-neutral-medium hover:text-white border border-white/5'
      }`}
    >
      {s === 'TD GAMES' ? '🏢 TD Games' : s === 'TD CONSULTING' ? '🏛 TD Consulting' : '👤 Cá nhân'}
    </button>
  ))}
</div>
```

---

## Task 6: Tạo 4 Invoice còn thiếu cho TD CONSULTING

Sau khi UI đã sẵn sàng, thêm thủ công (hoặc qua SQL) 4 invoice Jan–Apr 2026 của TD CONSULTING. Đây là dữ liệu thực — cần người dùng xác nhận số tiền + client trước khi insert.

- [ ] **Step 1: Hỏi user thông tin 4 invoice**

Cần biết: client name, amount, currency, issue_date, paid_date cho Jan / Feb / Mar / Apr 2026.

- [ ] **Step 2: Insert qua Invoice Editor UI** (sau Task 4 hoàn thành)

---

## Self-Review

### Spec Coverage
| Requirement | Task |
|---|---|
| `finance_bank_accounts` table | Task 1 |
| `billing_entity` + `receiving_account_id` trên invoices | Task 2 + Task 4 |
| Seed 6 tài khoản | Task 1 Step 2 |
| Invoice Editor chọn entity + TK ngân hàng | Task 4 |
| CashFlow 3 luồng | Task 5 |
| Luồng cá nhân chỉ hiện với admin/ke_toan | Task 5 Step 2+3+5 |
| 4 invoice TD CONSULTING còn thiếu | Task 6 |

### Gaps
- Task 6 cần user cung cấp số liệu thực → blocked cho đến khi có thông tin.
- RLS policy cho `finance_bank_accounts` dùng `invoice_accounts` làm bảng role-check (khớp với pattern hiện tại của dự án).
