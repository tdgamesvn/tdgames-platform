# CRM BD Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến CRM từ hệ thống ghi chép thành hệ thống thúc hành động: BD mở app biết ngay việc hôm nay, mọi hoạt động quy về đúng người, CEO đo được hiệu quả BD qua target/forecast/funnel.

**Architecture:** Giữ nguyên pattern hiện có — SPA React 19, service layer gọi Supabase trực tiếp, filter client-side. DB thêm 3 migration nhỏ (activity attribution, bd_targets, deal_stage_history + trigger). Không thêm dependency mới, không thêm edge function mới.

**Tech Stack:** React 19 + TypeScript, Vite, Supabase (PostgreSQL + RLS), Tailwind (config trong `index.html`).

## Global Constraints

- Repo: `/Users/tdgames_mac01/Work/apps/tdgames-platforms` — mọi path dưới đây relative từ root.
- **KHÔNG có test framework** trong repo. Vòng verify mỗi task = `npm run lint` (tsc --noEmit) + `npm run build` phải pass. DB verify bằng SQL qua Supabase MCP (`mcp__supabase__execute_sql`).
- Migration SQL: đặt tên `2026MMDDHHMMSS_<name>.sql` trong `supabase/migrations/`, apply bằng `mcp__supabase__apply_migration`. Đọc skill `supabase:supabase-postgres-best-practices` trước khi viết SQL.
- **GitNexus:** chạy `impact({target: "<symbol>", direction: "upstream"})` trước khi sửa symbol có sẵn (`createActivity`, `fetchDeals`, `BdDashboard`, `useCrmState`, `CrmApp`). Chạy `detect_changes()` trước mỗi commit.
- UI: đọc `.agent/meta/STYLE_GUIDE.md` trước khi viết component. Card = `bg-surface border border-white/8 rounded-xl`; KPI label = `text-[10px] font-black text-neutral-600 uppercase tracking-wider`; KPI value = `text-2xl font-black`. Không dùng `max-w-*` trong tab component.
- Workspace 2 sổ: bảng gốc mới (`crm_bd_targets`) phải có cột `entity text not null default 'TD GAMES'`. Bảng con (`crm_deal_stage_history`) kế thừa qua deal, không cần.
- RLS role check: copy đúng pattern từ migration `supabase/migrations/20260713100000_outreach_lead_ownership.sql` (admin/ke_toan check qua JWT user_metadata role) — KHÔNG tự bịa biểu thức mới.
- Ngôn ngữ UI: tiếng Việt, giọng ngắn gọn như các tab hiện có.
- Commit message có footer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Activity attribution — `actor_id` + `deal_id`

**Files:**
- Create: `supabase/migrations/20260722090000_crm_activity_attribution.sql`
- Modify: `types.ts` (interface `CrmActivity`, ~line 351)
- Modify: `apps/crm/services/crmService.ts:251` (`createActivity`)

**Interfaces:**
- Consumes: bảng `crm_activities`, `crm_deals` có sẵn.
- Produces: `CrmActivity` thêm `deal_id?: string | null; actor_id?: string | null;`. `createActivity` giữ nguyên signature `(activity: Omit<CrmActivity, 'id' | 'created_at'>) => Promise<CrmActivity>` — tự điền `actor_id` từ session nếu caller không truyền. Task 5/6 đọc `actor_id` để attribution.

- [x] **Step 1: Viết + apply migration**

```sql
-- 20260722090000_crm_activity_attribution.sql
alter table crm_activities
  add column if not exists deal_id uuid references crm_deals(id) on delete set null,
  add column if not exists actor_id uuid references auth.users(id) on delete set null;
create index if not exists idx_crm_activities_deal_id on crm_activities(deal_id);
create index if not exists idx_crm_activities_actor_id on crm_activities(actor_id);
```

Apply qua `mcp__supabase__apply_migration`, verify: `select column_name from information_schema.columns where table_name='crm_activities' and column_name in ('deal_id','actor_id');` → 2 rows.

- [x] **Step 2: Cập nhật type**

Trong `types.ts`, interface `CrmActivity` thêm 2 field sau `actor: string;`:

```typescript
  actor_id?: string | null;   // auth.users.id — attribution thật, actor text chỉ để display
  deal_id?: string | null;    // gắn activity vào deal (optional)
```

- [x] **Step 3: Sửa `createActivity` — auto-fill actor_id tại service (root-cause, mọi call site hưởng free)**

```typescript
export async function createActivity(activity: Omit<CrmActivity, 'id' | 'created_at'>): Promise<CrmActivity> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('crm_activities')
    .insert({ ...activity, actor_id: activity.actor_id ?? user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as CrmActivity;
}
```

(Giữ nguyên phần select/error hiện có nếu khác — chỉ thêm getUser + spread actor_id. KHÔNG sửa call site nào — `ActivityTimeline.tsx:54` giữ nguyên.)

- [x] **Step 4: Verify**

Run: `npm run lint && npm run build` → pass. Tạo 1 activity qua UI dev (hoặc SQL insert giả lập) rồi `select actor_id from crm_activities order by created_at desc limit 1;` → không null khi tạo từ UI.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/20260722090000_crm_activity_attribution.sql types.ts apps/crm/services/crmService.ts
git commit -m "feat(crm): activity attribution — actor_id + deal_id"
```

---

### Task 2: Service `fetchMyDay` — gom việc hôm nay

**Files:**
- Modify: `apps/crm/services/crmService.ts` (thêm cuối file)
- Modify: `types.ts` (thêm interface `MyDayData` cạnh cụm CRM)

**Interfaces:**
- Consumes: `fetchDeals(): Promise<CrmDeal[]>`, `fetchClients()`, `fetchActivities(clientId?, limit?)` có sẵn trong `crmService.ts`; `CrmQuotation.valid_until`, `CrmDeal.next_follow_up/stage/owner_id`.
- Produces: `fetchMyDay(userId: string, isManager: boolean): Promise<MyDayData>` — Task 3 render, Task 6 tái dùng `coldClients`.

- [x] **Step 1: Thêm type vào `types.ts`**

```typescript
// ── CRM My Day ────────────────────────────────────────────────
export interface MyDayData {
  overdueFollowups: CrmDeal[];   // next_follow_up <= hôm nay, deal đang mở
  noNextStep: CrmDeal[];         // deal đang mở KHÔNG có next_follow_up — vi phạm kỷ luật sales
  expiringQuotes: CrmQuotation[]; // status 'sent', valid_until trong 7 ngày tới hoặc đã quá
  coldClients: CrmClient[];      // client active, không có activity nào 90 ngày
}
```

- [x] **Step 2: Implement `fetchMyDay` cuối `crmService.ts`**

```typescript
// ── My Day ────────────────────────────────────────────────────
const OPEN_STAGES: CrmDealStage[] = ['lead', 'contacted', 'negotiating', 'proposal_sent', 'contracting'];

export async function fetchMyDay(userId: string, isManager: boolean): Promise<MyDayData> {
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const [deals, clients] = await Promise.all([fetchDeals(), fetchClients()]);
  const mine = (d: CrmDeal) => isManager || d.owner_id === userId;
  const open = deals.filter(d => OPEN_STAGES.includes(d.stage) && mine(d));

  const overdueFollowups = open.filter(d => d.next_follow_up && new Date(d.next_follow_up) <= today);
  const noNextStep = open.filter(d => !d.next_follow_up);

  const in7days = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: quotes, error: qErr } = await supabase
    .from('crm_quotations').select('*')
    .eq('status', 'sent').lte('valid_until', in7days)
    .order('valid_until');
  if (qErr) throw qErr;

  // ponytail: cold-client scan qua 500 activity gần nhất — đủ cho quy mô hiện tại,
  // chuyển sang SQL group-by nếu activity vượt vài nghìn dòng
  const acts = await fetchActivities(undefined, 500);
  const lastAct: Record<string, number> = {};
  for (const a of acts) {
    const t = new Date(a.activity_date || a.created_at).getTime();
    if (!lastAct[a.client_id] || t > lastAct[a.client_id]) lastAct[a.client_id] = t;
  }
  const cutoff = Date.now() - 90 * 86_400_000;
  const coldClients = clients.filter(c =>
    c.status === 'active' && (!lastAct[c.id] || lastAct[c.id] < cutoff)
  );

  return { overdueFollowups, noNextStep, expiringQuotes: (quotes || []) as CrmQuotation[], coldClients };
}
```

(Import bổ sung `MyDayData` vào dòng import types đầu file. `fetchQuotations(dealId)` có sẵn nhận dealId nên không tái dùng được — query trực tiếp như trên.)

- [x] **Step 3: Verify**

Run: `npm run lint` → pass.

- [x] **Step 4: Commit**

```bash
git add types.ts apps/crm/services/crmService.ts
git commit -m "feat(crm): fetchMyDay service — overdue/no-next-step/expiring-quotes/cold-clients"
```

---

### Task 3: Tab "My Day" — landing mặc định của CRM

**Files:**
- Create: `apps/crm/components/MyDayTab.tsx`
- Modify: `apps/crm/hooks/useCrmState.ts:6` (thêm `'myday'` vào `CrmTab`; đổi default `activeTab` thành `'myday'`)
- Modify: `apps/crm/components/CrmApp.tsx` (TAB_MAP/TAB_LABELS/REVERSE_TAB + render, ~line 28–62)

**Interfaces:**
- Consumes: `fetchMyDay(userId, isManager)` từ Task 2; `hasAnyRole(currentUser, ['admin', 'ke_toan'])` từ `@/utils/roleUtils`; `currentUser.id`.
- Produces: `<MyDayTab currentUser={AccountUser} onOpenDeals={() => void} onOpenClients={() => void} />`.

- [x] **Step 1: Đăng ký tab**

`useCrmState.ts`: `export type CrmTab = 'myday' | 'dashboard' | ...` (thêm đầu union). Default `activeTab`: đổi giá trị fallback trong `useState<CrmTab>(...)` từ giá trị cũ sang `'myday'` (giữ nguyên logic đọc hash/localStorage nếu có).

`CrmApp.tsx`: thêm vào cả 3 map — `TAB_MAP: { myday: 'myday', ... }`, `TAB_LABELS: { myday: '☀️ Hôm nay', ... }` (đặt ĐẦU danh sách), `REVERSE_TAB: { myday: 'myday', ... }`.

- [x] **Step 2: Viết `MyDayTab.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { AccountUser, MyDayData, CrmDeal } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import { fetchMyDay } from '../services/crmService';

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const fmtValue = (v: number, cur: string) => `${cur === 'USD' ? '$' : ''}${v.toLocaleString()}${cur === 'VND' ? '₫' : ''}`;

const Section: React.FC<{ title: string; count: number; color: string; empty: string; children: React.ReactNode }> =
  ({ title, count, color, empty, children }) => (
    <div className="bg-surface border border-white/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">{title}</p>
        <span className="text-2xl font-black" style={{ color }}>{count}</span>
      </div>
      {count === 0 ? <p className="text-xs text-neutral-600">{empty}</p> : children}
    </div>
  );

const DealRow: React.FC<{ deal: CrmDeal; onClick: () => void; note?: string }> = ({ deal, onClick, note }) => (
  <button onClick={onClick} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-white truncate">{deal.title}</p>
      <p className="text-[10px] text-neutral-500 truncate">{deal.client_name} · {fmtValue(deal.value, deal.currency)}</p>
    </div>
    {note && <span className="text-[10px] font-black text-status-error whitespace-nowrap">{note}</span>}
  </button>
);

const MyDayTab: React.FC<{ currentUser: AccountUser; onOpenDeals: () => void; onOpenClients: () => void }> =
  ({ currentUser, onOpenDeals, onOpenClients }) => {
  const [data, setData] = useState<MyDayData | null>(null);
  const isManager = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  useEffect(() => {
    fetchMyDay(currentUser.id, isManager).then(setData).catch(() => setData(null));
  }, [currentUser.id, isManager]);

  if (!data) return <p className="text-neutral-500 text-sm animate-td-pulse text-center py-10">Đang tải việc hôm nay...</p>;

  const daysOverdue = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

  return (
    <div className="animate-fadeInUp grid grid-cols-1 md:grid-cols-2 gap-4">
      <Section title="Follow-up quá hạn" count={data.overdueFollowups.length} color="#FF3B30" empty="Sạch — không có follow-up trễ 💪">
        {data.overdueFollowups.map(d => (
          <DealRow key={d.id} deal={d} onClick={onOpenDeals}
            note={daysOverdue(d.next_follow_up!) > 0 ? `trễ ${daysOverdue(d.next_follow_up!)} ngày` : 'hôm nay'} />
        ))}
      </Section>
      <Section title="Deal chưa có bước tiếp theo" count={data.noNextStep.length} color="#FF9500" empty="Mọi deal đều có next step ✅">
        {data.noNextStep.map(d => <DealRow key={d.id} deal={d} onClick={onOpenDeals} note="đặt follow-up" />)}
      </Section>
      <Section title="Báo giá sắp hết hạn (7 ngày)" count={data.expiringQuotes.length} color="#0A84FF" empty="Không có báo giá nào cần chốt">
        {data.expiringQuotes.map(q => (
          <button key={q.id} onClick={onOpenDeals} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{q.quotation_number} · {q.title}</p>
              <p className="text-[10px] text-neutral-500">{q.client_name} · {fmtValue(q.total, q.currency)}</p>
            </div>
            <span className="text-[10px] font-black text-status-warning whitespace-nowrap">hạn {fmtDate(q.valid_until)}</span>
          </button>
        ))}
      </Section>
      <Section title="Khách nguội (90 ngày im lặng)" count={data.coldClients.length} color="#AF52DE" empty="Mọi khách active đều có tương tác gần đây">
        {data.coldClients.map(c => (
          <button key={c.id} onClick={onOpenClients} className="w-full text-left px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer">
            <p className="text-xs font-semibold text-white truncate">{c.name}</p>
            <p className="text-[10px] text-neutral-500">{c.country} · {c.industry}</p>
          </button>
        ))}
      </Section>
    </div>
  );
};

export default MyDayTab;
```

(Nếu `text-status-error/warning/success` không tồn tại trong Tailwind config ở `index.html`, dùng inline style màu `#FF3B30`/`#FFCC00` — kiểm tra BdDashboard.tsx dòng 296–297 dùng `text-status-success` nên khả năng cao đã có.)

- [x] **Step 3: Render trong `CrmApp.tsx`**

Import `MyDayTab`, thêm nhánh render cạnh các tab khác (theo pattern render tab hiện có trong file):

```tsx
{activeTab === 'myday' && (
  <MyDayTab currentUser={currentUser}
    onOpenDeals={() => setActiveTab('deals')}
    onOpenClients={() => setActiveTab('clients')} />
)}
```

(`setActiveTab` lấy từ `useCrmState` — xem cách các tab khác switch trong file.)

- [x] **Step 4: Verify chạy thật**

Run: `npm run lint && npm run build` → pass. Dùng skill `/run` mở `localhost:3000/#crm` → tab "☀️ Hôm nay" là landing mặc định, 4 section render, click deal row nhảy sang Deal Pipeline.

- [x] **Step 5: Commit**

```bash
git add apps/crm/components/MyDayTab.tsx apps/crm/hooks/useCrmState.ts apps/crm/components/CrmApp.tsx
git commit -m "feat(crm): My Day tab — landing hành động cho BD"
```

---

### Task 4: BD Targets — quota, attainment, coverage, weighted forecast

**Files:**
- Create: `supabase/migrations/20260722091000_crm_bd_targets.sql`
- Modify: `types.ts` (thêm `CrmBdTarget`)
- Modify: `apps/crm/services/crmService.ts` (thêm `fetchBdTargets`, `upsertBdTarget`)
- Modify: `apps/crm/components/BdDashboard.tsx` (KPI row ~line 292–307)

**Interfaces:**
- Consumes: KPI đã tính sẵn trong BdDashboard: `pipelineValue`, `totalWon`, `activeDeals`, `wonDeals`; RLS pattern từ `20260713100000_outreach_lead_ownership.sql`.
- Produces: `fetchBdTargets(period: string): Promise<CrmBdTarget[]>`, `upsertBdTarget(t: { bd_id: string; period: string; target_usd: number; entity: string }): Promise<void>`. Period format `'YYYY-Qn'` — Task 6 dùng lại.

- [x] **Step 1: Migration**

```sql
-- 20260722091000_crm_bd_targets.sql
create table if not exists crm_bd_targets (
  id uuid primary key default gen_random_uuid(),
  bd_id uuid not null references auth.users(id) on delete cascade,
  period text not null,                       -- 'YYYY-Qn', vd '2026-Q3'
  target_usd numeric not null default 0,
  entity text not null default 'TD GAMES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bd_id, period, entity)
);
alter table crm_bd_targets enable row level security;
-- Copy CHÍNH XÁC biểu thức admin/ke_toan check từ 20260713100000_outreach_lead_ownership.sql:
create policy bd_targets_select on crm_bd_targets for select to authenticated
  using (bd_id = auth.uid() or <ADMIN_KE_TOAN_CHECK>);
create policy bd_targets_admin_all on crm_bd_targets for all to authenticated
  using (<ADMIN_KE_TOAN_CHECK>) with check (<ADMIN_KE_TOAN_CHECK>);
```

(`<ADMIN_KE_TOAN_CHECK>` = biểu thức thật copy từ migration tham chiếu — người thực thi PHẢI mở file đó lấy đúng cú pháp, không tự viết.) Apply + verify: `select * from pg_policies where tablename='crm_bd_targets';` → 2 policies.

- [x] **Step 2: Type + service**

`types.ts`:

```typescript
export interface CrmBdTarget {
  id: string;
  bd_id: string;
  period: string;      // 'YYYY-Qn'
  target_usd: number;
  entity: string;
  created_at: string;
  updated_at: string;
}
```

`crmService.ts` (cuối file):

```typescript
// ── BD Targets ────────────────────────────────────────────────
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

export async function fetchBdTargets(period: string): Promise<CrmBdTarget[]> {
  const { data, error } = await supabase.from('crm_bd_targets').select('*').eq('period', period);
  if (error) throw error;
  return (data || []) as CrmBdTarget[];
}

export async function upsertBdTarget(t: { bd_id: string; period: string; target_usd: number; entity: string }): Promise<void> {
  const { error } = await supabase.from('crm_bd_targets')
    .upsert({ ...t, updated_at: new Date().toISOString() }, { onConflict: 'bd_id,period,entity' });
  if (error) throw error;
}
```

- [x] **Step 3: KPI mới trong `BdDashboard.tsx`**

Chạy `impact({target: "BdDashboard", direction: "upstream"})` trước. Trong component: load target của user hiện tại (`fetchBdTargets(currentPeriod())` trong useEffect, lấy row `bd_id === currentUser.id`, workspace filter bằng `matchesWorkspace(t.entity, workspace)` nếu dashboard đã có workspace context — xem đầu file). Tính:

```typescript
const weightedForecast = activeDeals.reduce((s, d) => s + d.value * (d.probability || 0) / 100, 0);
const target = myTarget?.target_usd || 0;
const attainment = target > 0 ? Math.round((totalWon / target) * 100) : null;
const gap = Math.max(0, target - totalWon);
const coverage = gap > 0 ? (pipelineValue / gap) : null; // chuẩn sales: >= 3x là khỏe
```

Thêm 3 card vào mảng KPI hiện có (line ~295):

```typescript
{ label: 'Target quý', value: attainment !== null ? `${attainment}%` : 'Chưa đặt', sub: target > 0 ? `${fmtValue(totalWon, 'USD')} / ${fmtValue(target, 'USD')}` : 'Admin đặt target', color: attainment !== null && attainment >= 100 ? 'text-status-success' : 'text-white' },
{ label: 'Forecast (weighted)', value: fmtValue(Math.round(weightedForecast), 'USD'), sub: 'Σ value × probability', color: 'text-white' },
{ label: 'Pipeline coverage', value: coverage !== null ? `${coverage.toFixed(1)}x` : '—', sub: 'mục tiêu ≥ 3x phần còn thiếu', color: coverage !== null && coverage < 3 ? 'text-status-error' : 'text-status-success' },
```

Admin đặt target: dưới KPI row, nếu `hasAnyRole(currentUser, ['admin'])` render 1 input số + nút Lưu gọi `upsertBdTarget({ bd_id: selectedBdId, period: currentPeriod(), target_usd: value, entity: getWorkspace() })`. Nếu dashboard đã có dropdown chọn BD thì dùng lại; chưa có thì chỉ cho đặt target của chính mình + note `// ponytail: admin đặt target từng BD qua dropdown — thêm khi có >2 BD`.

- [x] **Step 4: Verify + commit**

Run: `npm run lint && npm run build` → pass. `/run` → dashboard hiện 3 KPI mới; đặt target 50000 → attainment/coverage đổi theo.

```bash
git add supabase/migrations/20260722091000_crm_bd_targets.sql types.ts apps/crm/services/crmService.ts apps/crm/components/BdDashboard.tsx
git commit -m "feat(crm): BD targets — attainment, weighted forecast, pipeline coverage"
```

---

### Task 5: Deal stage history + aging

**Files:**
- Create: `supabase/migrations/20260722092000_crm_deal_stage_history.sql`
- Modify: `types.ts` (`CrmDeal` thêm `stage_entered_at`)
- Modify: `apps/crm/components/pipeline/DealCard.tsx` (~line 52, cạnh badge follow-up)
- Modify: `apps/crm/components/BdDashboard.tsx` (1 KPI sales cycle)

**Interfaces:**
- Consumes: `crm_deals`, `fetchDeals()` (select `*` nên tự có cột mới).
- Produces: cột `crm_deals.stage_entered_at: string`; bảng `crm_deal_stage_history(deal_id, from_stage, to_stage, changed_by, changed_at)` — Task 6 và báo cáo tương lai đọc.

- [x] **Step 1: Migration — trigger log stage change**

```sql
-- 20260722092000_crm_deal_stage_history.sql
alter table crm_deals add column if not exists stage_entered_at timestamptz not null default now();

create table if not exists crm_deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references crm_deals(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index if not exists idx_deal_stage_history_deal on crm_deal_stage_history(deal_id);
alter table crm_deal_stage_history enable row level security;
create policy stage_history_read on crm_deal_stage_history for select to authenticated using (true);

create or replace function crm_log_deal_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into crm_deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, auth.uid());
  elsif new.stage is distinct from old.stage then
    new.stage_entered_at := now();
    insert into crm_deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_deal_stage on crm_deals;
create trigger trg_crm_deal_stage before insert or update on crm_deals
for each row execute function crm_log_deal_stage();
```

Apply, verify: update stage 1 deal bất kỳ qua SQL → `select * from crm_deal_stage_history order by changed_at desc limit 1;` → có row from/to đúng, và `stage_entered_at` của deal đổi.

- [x] **Step 2: Type + aging badge**

`types.ts` — `CrmDeal` thêm `stage_entered_at?: string;` (sau `updated_at`).

`DealCard.tsx` — chạy `impact` trước, rồi thêm cạnh badge follow-up (line ~52):

```tsx
{deal.stage_entered_at && !['won', 'lost'].includes(deal.stage) && (() => {
  const days = Math.floor((Date.now() - new Date(deal.stage_entered_at).getTime()) / 86_400_000);
  return days >= 14 ? (
    <span className="text-[10px] font-black uppercase text-status-error" title={`Nằm ở stage này ${days} ngày`}>
      🔥 {days}d
    </span>
  ) : null;
})()}
```

- [x] **Step 3: KPI sales cycle trong BdDashboard**

```typescript
const cycles = wonDeals
  .filter(d => d.actual_close_date)
  .map(d => (new Date(d.actual_close_date!).getTime() - new Date(d.created_at).getTime()) / 86_400_000);
const avgCycle = cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;
```

Thêm card: `{ label: 'Sales cycle TB', value: avgCycle !== null ? `${avgCycle} ngày` : '—', sub: 'từ tạo deal đến won', color: 'text-white' }`.

- [x] **Step 4: Verify + commit**

`npm run lint && npm run build` → pass. `/run` → deal cũ >14 ngày hiện 🔥.

```bash
git add supabase/migrations/20260722092000_crm_deal_stage_history.sql types.ts apps/crm/components/pipeline/DealCard.tsx apps/crm/components/BdDashboard.tsx
git commit -m "feat(crm): deal stage history + aging badge + avg sales cycle"
```

---

### Task 6: Funnel report + BD leaderboard (CEO view)

**Files:**
- Modify: `apps/crm/services/crmService.ts` (thêm `fetchBdFunnel`)
- Create: `apps/crm/components/BdLeaderboard.tsx`
- Modify: `apps/crm/components/BdDashboard.tsx` (render leaderboard cho admin/ke_toan)

**Interfaces:**
- Consumes: `crm_outreach_leads` (`assigned_bd_id`, `outreach_status`, `replied_at`), `fetchDeals()` (`owner_id`, `owner_name`, `stage`, `value`), `fetchBdTargets` + `currentPeriod` (Task 4). RLS: admin/ke_toan đọc được mọi lead nên funnel toàn cục chỉ chạy đúng với manager — component chỉ render cho manager.
- Produces: `fetchBdFunnel(): Promise<BdFunnelRow[]>` với `BdFunnelRow = { bdId: string; bdName: string; sent: number; replied: number; deals: number; won: number; wonValue: number; targetUsd: number }`.

- [x] **Step 1: Service**

```typescript
// ── BD Funnel (manager only — RLS tự giới hạn data nếu BD thường gọi) ──
export interface BdFunnelRow {
  bdId: string; bdName: string;
  sent: number; replied: number;
  deals: number; won: number; wonValue: number;
  targetUsd: number;
}

export async function fetchBdFunnel(): Promise<BdFunnelRow[]> {
  const [{ data: leads, error }, deals, targets] = await Promise.all([
    supabase.from('crm_outreach_leads').select('assigned_bd_id, outreach_status, replied_at'),
    fetchDeals(),
    fetchBdTargets(currentPeriod()),
  ]);
  if (error) throw error;

  const rows: Record<string, BdFunnelRow> = {};
  const row = (id: string, name: string) =>
    rows[id] ||= { bdId: id, bdName: name, sent: 0, replied: 0, deals: 0, won: 0, wonValue: 0, targetUsd: 0 };

  for (const l of leads || []) {
    if (!l.assigned_bd_id) continue;
    const r = row(l.assigned_bd_id, '');
    if (l.outreach_status !== 'pending') r.sent++;
    if (l.replied_at) r.replied++;
  }
  for (const d of deals) {
    const r = row(d.owner_id, d.owner_name || '');
    if (d.owner_name) r.bdName = d.owner_name;
    r.deals++;
    if (d.stage === 'won') { r.won++; r.wonValue += d.value; }
  }
  for (const t of targets) if (rows[t.bd_id]) rows[t.bd_id].targetUsd = t.target_usd;
  return Object.values(rows).sort((a, b) => b.wonValue - a.wonValue);
}
```

(Nếu `bdName` rỗng — BD chỉ có lead chưa có deal — hiển thị `bdId.slice(0, 8)`; lookup tên đẹp hơn thêm sau khi cần.)

- [x] **Step 2: Component `BdLeaderboard.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { fetchBdFunnel, BdFunnelRow } from '../services/crmService';

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

const BdLeaderboard: React.FC = () => {
  const [rows, setRows] = useState<BdFunnelRow[]>([]);
  useEffect(() => { fetchBdFunnel().then(setRows).catch(() => setRows([])); }, []);
  if (rows.length === 0) return null;

  return (
    <div className="bg-surface border border-white/8 rounded-xl p-4 space-y-3">
      <p className="text-[10px] font-black text-neutral-600 uppercase tracking-wider">Leaderboard BD — funnel outreach → revenue</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] font-black text-neutral-600 uppercase tracking-wider text-left">
            <th className="py-2">BD</th><th>Sent</th><th>Replied</th><th>Reply %</th>
            <th>Deals</th><th>Won</th><th>Won value</th><th>Attainment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.bdId} className="border-t border-white/5 text-neutral-300">
              <td className="py-2 font-semibold text-white">{r.bdName || r.bdId.slice(0, 8)}</td>
              <td>{r.sent}</td><td>{r.replied}</td><td>{pct(r.replied, r.sent)}</td>
              <td>{r.deals}</td><td>{r.won}</td>
              <td className="font-black text-status-success">${r.wonValue.toLocaleString()}</td>
              <td>{pct(r.wonValue, r.targetUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BdLeaderboard;
```

- [x] **Step 3: Render trong `BdDashboard.tsx`** — cuối dashboard, chỉ manager:

```tsx
{hasAnyRole(currentUser, ['admin', 'ke_toan']) && <BdLeaderboard />}
```

- [x] **Step 4: Verify + commit**

`npm run lint && npm run build` → pass. `/run` với account admin → leaderboard hiện đủ cột; account BD thường → không render.

```bash
git add apps/crm/components/BdLeaderboard.tsx apps/crm/services/crmService.ts apps/crm/components/BdDashboard.tsx
git commit -m "feat(crm): BD funnel leaderboard — outreach → revenue per BD"
```

---

## Sau khi xong toàn bộ

1. GitNexus `detect_changes({scope: "compare", base_ref: "main"})` — confirm phạm vi.
2. `npm run build` pass lần cuối + `/code-review` cho toàn diff.
3. Cập nhật `.agent/meta/TASKS.md` + `LOG.md`; thêm mục "My Day / BD Targets / Stage History" vào `CLAUDE.md` phần CRM tabs.
4. Đã cắt khỏi scope (thêm khi cần): Telegram nhắc My Day hàng sáng (nối `agent-telegram` + pg_cron), auto-log outreach email thành activity (đa số lead chưa có `client_id` — cần làm `client_id` nullable trước), per-template reply rate.
