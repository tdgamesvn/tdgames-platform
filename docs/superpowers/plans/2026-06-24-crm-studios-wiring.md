# CRM Studios Tab — Wiring & Edge Function Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện tích hợp tab Studios vào CrmApp và đồng bộ edge function ghi vào đúng bảng `crm_studios`.

**Architecture:**
- `crm_studios` (1071 rows) + `crm_outreach_leads.studio_id` đều đã tồn tại trên DB.
- `StudiosTab.tsx` + `studioService.ts` đã viết xong và đúng.
- Còn 3 điểm chưa nối: (1) CrmApp chưa render Studios tab, (2) edge function vẫn ghi vào `crm_discovered_studios`, (3) FK constraint chưa có.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres + Edge Functions Deno), Tailwind.

## Global Constraints

- Không tạo file CSS mới — Tailwind class + inline style theo STYLE_GUIDE.md.
- Không đổi tên symbol mà không dùng gitnexus_rename.
- Edge function deploy bằng `supabase functions deploy outreach-auto-discovery`.
- Build pass: `npm run build` phải thành công sau mỗi task.

---

### Task 1: Wire Studios tab vào CrmApp.tsx

**Files:**
- Modify: `apps/crm/components/CrmApp.tsx`

**Context:** `CrmApp.tsx` đã có `StudiosTab` imported (line 17) và `TAB_MAP`/`TAB_LABELS` đã có `studios`. Nhưng 3 chỗ còn thiếu:
1. `REVERSE_TAB` không có `studios` → click nav không chuyển tab
2. `accessibleTabs` cả 2 role không có `'studios'` → tab không hiện trong Navbar
3. Không có `{state.activeTab === 'studios' && <StudiosTab />}` trong render

- [ ] **Step 1: Thêm `studios` vào REVERSE_TAB**

File: `apps/crm/components/CrmApp.tsx`, tìm block `REVERSE_TAB`:

```typescript
const REVERSE_TAB: Record<string, CrmTab> = {
  dashboard: 'dashboard',
  deals:     'deals',
  history:   'clients',
  tasks:     'projects',
  settings:  'documents',
  activity:  'payments',
  board:     'activities',
  outreach:  'outreach',
  studios:   'studios',   // ← thêm dòng này
};
```

- [ ] **Step 2: Thêm `'studios'` vào `accessibleTabs` cả 2 role**

Tìm đoạn:
```typescript
const accessibleTabs = isBd
  ? ['dashboard', 'deals', 'history', 'tasks', 'settings', 'board', 'outreach']
  : ['dashboard', 'deals', 'history', 'tasks', 'settings', 'activity', 'board', 'outreach'];
```

Đổi thành:
```typescript
const accessibleTabs = isBd
  ? ['dashboard', 'deals', 'history', 'tasks', 'settings', 'board', 'outreach', 'studios']
  : ['dashboard', 'deals', 'history', 'tasks', 'settings', 'activity', 'board', 'outreach', 'studios'];
```

- [ ] **Step 3: Thêm render block cho StudiosTab**

Sau block `{state.activeTab === 'outreach' && ...}` (ngay trước `</main>`), thêm:
```tsx
{/* ── Studios Tab ── */}
{state.activeTab === 'studios' && (
  <StudiosTab />
)}
```

- [ ] **Step 4: Verify build pass**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: Build completed without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/components/CrmApp.tsx
git commit -m "feat(crm): wire Studios tab into CrmApp navigation and render"
```

---

### Task 2: Thêm FK constraint trên `crm_outreach_leads.studio_id`

**Files:** DB-only, không có file code.

**Context:** Column `studio_id` đã tồn tại nhưng không có FK → có thể có orphan references. 315/549 leads đã có `studio_id` filled. 234 leads còn lại là `NULL` (không thuộc studio nào — OK).

- [ ] **Step 1: Kiểm tra FK có chưa**

Chạy qua MCP `execute_sql`:
```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'crm_outreach_leads'::regclass
  AND contype = 'f'
  AND conname LIKE '%studio%';
```
Expected: 0 rows (FK chưa có).

- [ ] **Step 2: Kiểm tra không có orphan studio_id**

```sql
SELECT COUNT(*) AS orphans
FROM crm_outreach_leads l
WHERE l.studio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM crm_studios s WHERE s.id = l.studio_id
  );
```
Expected: `0` — nếu > 0 thì NULL hóa những orphan đó trước.

Nếu có orphan:
```sql
UPDATE crm_outreach_leads
SET studio_id = NULL
WHERE studio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM crm_studios s WHERE s.id = studio_id
  );
```

- [ ] **Step 3: Thêm FK constraint**

```sql
ALTER TABLE crm_outreach_leads
  ADD CONSTRAINT fk_outreach_leads_studio
  FOREIGN KEY (studio_id)
  REFERENCES crm_studios(id)
  ON DELETE SET NULL;
```
Expected: `ALTER TABLE` — không lỗi.

- [ ] **Step 4: Thêm index (performance)**

```sql
CREATE INDEX IF NOT EXISTS idx_outreach_leads_studio_id
  ON crm_outreach_leads(studio_id)
  WHERE studio_id IS NOT NULL;
```

---

### Task 3: Cập nhật Edge Function `outreach-auto-discovery`

**Files:**
- Modify: `supabase/functions/outreach-auto-discovery/index.ts`

**Context:** Edge function hiện:
1. Đọc exclusion list từ `crm_discovered_studios` (line 154-158)
2. Insert new studios vào `crm_discovered_studios` (line 233-246)

Cần đổi cả 2 sang `crm_studios`. Khi insert vào `crm_studios` cần thêm `source: 'discovered'` và dùng `discovered_at` (cùng tên).

- [ ] **Step 1: Đổi exclusion list query từ `crm_discovered_studios` → `crm_studios`**

Tìm đoạn (line ~154):
```typescript
supabase
  .from("crm_discovered_studios")
  .select("apollo_id")
  .gte("discovered_at", recentCutoff.toISOString()),
```

Đổi thành:
```typescript
supabase
  .from("crm_studios")
  .select("apollo_id")
  .gte("discovered_at", recentCutoff.toISOString()),
```

- [ ] **Step 2: Đổi insert studios từ `crm_discovered_studios` → `crm_studios`**

Tìm đoạn (line ~232):
```typescript
const { error: studiosErr } = await supabase.from("crm_discovered_studios").upsert(
  result.new_apollo_ids.map(s => ({
    apollo_id: s.apollo_id,
    studio_name: s.studio_name,
    country: s.country,
    contacts_found: s.contacts_found,
    discovered_at: new Date().toISOString(),
  })),
  { onConflict: "apollo_id" },
);
if (studiosErr) {
  console.error("[auto-discovery] studios upsert failed:", studiosErr.message);
}
```

Đổi thành:
```typescript
const { error: studiosErr } = await supabase.from("crm_studios").upsert(
  result.new_apollo_ids.map(s => ({
    apollo_id: s.apollo_id,
    studio_name: s.studio_name,
    country: s.country,
    contacts_found: s.contacts_found,
    source: "discovered",
    bd_status: "uncontacted",
    discovered_at: new Date().toISOString(),
  })),
  { onConflict: "apollo_id" },
);
if (studiosErr) {
  console.error("[auto-discovery] studios upsert failed:", studiosErr.message);
}
```

- [ ] **Step 3: Verify build + type check**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
```
Expected: Build pass.

- [ ] **Step 4: Deploy edge function**

```bash
cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && supabase functions deploy outreach-auto-discovery
```
Expected: `Deployed outreach-auto-discovery` — không lỗi.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/outreach-auto-discovery/index.ts
git commit -m "fix(edge): outreach-auto-discovery writes to crm_studios instead of crm_discovered_studios"
```

---

## Checklist tự review

- [x] Task 1 wires tab mà không đổi logic hiện có của các tab khác
- [x] Task 2 dùng `ON DELETE SET NULL` → xóa studio không xóa lead, chỉ orphan hóa
- [x] Task 3 thêm `source: 'discovered'` + `bd_status: 'uncontacted'` khi insert studio mới
- [x] Edge function vẫn dùng `onConflict: "apollo_id"` — cần có unique constraint trên `crm_studios.apollo_id`

**⚠️ Note:** Trước khi deploy Task 3, verify `crm_studios` có UNIQUE constraint trên `apollo_id`:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'crm_studios' AND indexname LIKE '%apollo%';
```
