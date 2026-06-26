# CRM Payment Schedule — P1: Foundation (DB + Types + Service)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo DB table `crm_payment_schedules`, thêm TypeScript interface, và viết service CRUD — nền tảng cho P2 và P3.

**Architecture:** Bảng mới join vào `crm_projects` (ON DELETE CASCADE). Service file riêng `crmPaymentScheduleService.ts` để tách bạch với `crmService.ts` vốn đã lớn. Types thêm vào `types.ts` ngay sau `CrmQuotation`.

**Tech Stack:** Supabase (Postgres + RLS), TypeScript, `@/services/supabaseClient`

## Global Constraints

- Supabase import: `import { supabase } from '@/services/supabaseClient';`
- Types import: `import type { CrmPaymentSchedule } from '@/types';`
- RLS pattern: dùng `raw_user_meta_data->>'role'` và `raw_user_meta_data->'secondary_roles' ? 'rolename'` (xem migration hiện tại trong `supabase/migrations/`)
- Build check: `npm run build` từ root project sau mỗi task

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260625200000_crm_payment_schedules.sql`

**Interfaces:**
- Produces: table `crm_payment_schedules` với RLS policies cho select/insert/update/delete

- [ ] **Step 1: Viết migration file**

```sql
-- supabase/migrations/20260625200000_crm_payment_schedules.sql

CREATE TABLE IF NOT EXISTS crm_payment_schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES crm_projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  amount      numeric     NOT NULL DEFAULT 0,
  currency    text        NOT NULL DEFAULT 'VND',
  due_date    date        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoiced_at timestamptz,
  paid_at     timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE crm_payment_schedules ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_crm_ps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_ps_updated_at
  BEFORE UPDATE ON crm_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION set_crm_ps_updated_at();

-- ── RLS Policies ──────────────────────────────────────

-- SELECT: tất cả user đã đăng nhập đều xem được
CREATE POLICY "crm_ps_select" ON crm_payment_schedules
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: admin và bd
CREATE POLICY "crm_ps_insert" ON crm_payment_schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );

-- UPDATE: admin, ke_toan, bd (column restrictions enforced at app layer)
CREATE POLICY "crm_ps_update" ON crm_payment_schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'ke_toan', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'ke_toan'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );

-- DELETE: admin và bd
CREATE POLICY "crm_ps_delete" ON crm_payment_schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'bd')
          OR raw_user_meta_data->'secondary_roles' ? 'admin'
          OR raw_user_meta_data->'secondary_roles' ? 'bd'
        )
    )
  );
```

- [ ] **Step 2: Apply migration qua Supabase MCP**

Dùng tool `mcp__supabase__apply_migration` với nội dung file trên.

Hoặc nếu dùng CLI:
```bash
npx supabase db push
```

Expected: migration applied thành công, không có lỗi.

- [ ] **Step 3: Verify table tồn tại**

Dùng `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'crm_payment_schedules'
ORDER BY ordinal_position;
```

Expected: 11 columns (id, project_id, name, amount, currency, due_date, status, invoiced_at, paid_at, notes, created_at, updated_at).

- [ ] **Step 4: Verify RLS policies**

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'crm_payment_schedules';
```

Expected: 4 policies (crm_ps_select, crm_ps_insert, crm_ps_update, crm_ps_delete).

---

### Task 2: Add CrmPaymentSchedule to types.ts

**Files:**
- Modify: `types.ts` (sau interface `CrmQuotation` — khoảng line 403)

**Interfaces:**
- Produces: `CrmPaymentSchedule` interface export

- [ ] **Step 1: Tìm vị trí chèn**

Mở `types.ts`, tìm dòng kết thúc của `interface CrmQuotation { ... }`. Interface mới sẽ thêm ngay sau.

- [ ] **Step 2: Thêm interface**

Chèn đoạn code sau, ngay sau closing `}` của `CrmQuotation`:

```typescript
export interface CrmPaymentSchedule {
  id: string;
  project_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string; // 'YYYY-MM-DD'
  status: 'pending' | 'invoiced' | 'paid';
  invoiced_at?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: build thành công, không có TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add types.ts supabase/migrations/20260625200000_crm_payment_schedules.sql
git commit -m "feat(crm): add crm_payment_schedules table + CrmPaymentSchedule type"
```

---

### Task 3: Create crmPaymentScheduleService.ts

**Files:**
- Create: `apps/crm/services/crmPaymentScheduleService.ts`

**Interfaces:**
- Consumes: `CrmPaymentSchedule` from `@/types`, `supabase` from `@/services/supabaseClient`
- Produces:
  - `fetchPaymentSchedulesByProject(projectId: string): Promise<CrmPaymentSchedule[]>`
  - `fetchAllPaymentSchedules(filters?): Promise<PaymentScheduleWithProject[]>`
  - `createPaymentSchedule(data): Promise<CrmPaymentSchedule>`
  - `updatePaymentSchedule(id, updates): Promise<void>`
  - `markPaymentScheduleInvoiced(id): Promise<void>`
  - `markPaymentSchedulePaid(id): Promise<void>`
  - `deletePaymentSchedule(id): Promise<void>`
  - `export interface PaymentScheduleWithProject extends CrmPaymentSchedule`

- [ ] **Step 1: Tạo file service**

```typescript
// apps/crm/services/crmPaymentScheduleService.ts

import { supabase } from '@/services/supabaseClient';
import type { CrmPaymentSchedule } from '@/types';

// ── Extended type dùng trong tracker (join với project + client) ──
export interface PaymentScheduleWithProject extends CrmPaymentSchedule {
  project_name: string;
  client_name: string;
  client_id: string;
}

// ── Fetch theo project ───────────────────────────────────────────
export async function fetchPaymentSchedulesByProject(
  projectId: string
): Promise<CrmPaymentSchedule[]> {
  const { data, error } = await supabase
    .from('crm_payment_schedules')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── Fetch toàn bộ (dùng trong tracker) ──────────────────────────
export async function fetchAllPaymentSchedules(filters?: {
  status?: string;    // 'pending' | 'invoiced' | 'paid' | 'overdue' (special)
  month?: string;     // 'YYYY-MM'
  clientId?: string;
}): Promise<PaymentScheduleWithProject[]> {
  let query = supabase
    .from('crm_payment_schedules')
    .select(`*, crm_projects(id, name, client_id, crm_clients(id, name))`)
    .order('due_date', { ascending: true });

  // 'overdue' là special case: pending + due_date < hôm nay
  if (filters?.status === 'overdue') {
    const today = new Date().toISOString().slice(0, 10);
    query = query.eq('status', 'pending').lt('due_date', today);
  } else if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters?.month) {
    const [y, m] = filters.month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    query = query
      .gte('due_date', `${filters.month}-01`)
      .lte('due_date', `${filters.month}-${pad(lastDay)}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((r: any): PaymentScheduleWithProject => ({
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    due_date: r.due_date,
    status: r.status,
    invoiced_at: r.invoiced_at,
    paid_at: r.paid_at,
    notes: r.notes,
    created_at: r.created_at,
    updated_at: r.updated_at,
    project_name: r.crm_projects?.name ?? '',
    client_name: r.crm_projects?.crm_clients?.name ?? '',
    client_id: r.crm_projects?.client_id ?? '',
  }));

  // Client filter áp dụng sau khi join (client_id nằm trên crm_projects)
  if (filters?.clientId) {
    return rows.filter(r => r.client_id === filters.clientId);
  }
  return rows;
}

// ── CRUD ─────────────────────────────────────────────────────────
export async function createPaymentSchedule(
  data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>
): Promise<CrmPaymentSchedule> {
  const { data: row, error } = await supabase
    .from('crm_payment_schedules')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return row;
}

// update chỉ các trường nội dung (không phải status) — dùng cho BD + admin
export async function updatePaymentSchedule(
  id: string,
  updates: Partial<Pick<CrmPaymentSchedule, 'name' | 'amount' | 'currency' | 'due_date' | 'notes'>>
): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// mark invoiced — dùng cho admin + ke_toan
export async function markPaymentScheduleInvoiced(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update({ status: 'invoiced', invoiced_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// mark paid — dùng cho admin + ke_toan
export async function markPaymentSchedulePaid(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePaymentSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_payment_schedules')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build thành công, không có TypeScript errors (file mới chưa được import ở đâu cả — OK).

- [ ] **Step 3: Commit**

```bash
git add apps/crm/services/crmPaymentScheduleService.ts
git commit -m "feat(crm): add crmPaymentScheduleService with full CRUD + tracker fetch"
```

---

**P1 complete.** Tiếp tục với `2026-06-25-crm-payment-schedule-p2-project-card.md`.
