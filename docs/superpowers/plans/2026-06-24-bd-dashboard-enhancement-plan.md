# BD Dashboard Enhancement — Implementation Plan

_Date: 2026-06-24_
_Spec: docs/superpowers/specs/2026-06-24-bd-dashboard-enhancement-design.md_
_Branch: feat/bd-dashboard-enhancement_

---

## Global Constraints

- Project: React 19 + TypeScript, Vite build
- Brand color: `#FF9500` (orange/primary), background `#0F0F0F` (dark theme)
- Style guide: `.agent/meta/STYLE_GUIDE.md` — must be followed for all UI
- Working directory: `.worktrees/feat/bd-dashboard-enhancement/` (git worktree)
- All migrations go in `supabase/migrations/` as `.sql` files
- Build must pass: `npm run build` from worktree root
- TypeScript must compile with no new errors
- No new UI patterns — extend style guide if needed
- Sếp confirmed Feature 3 uses Option A: include the contract_value input in the document form

---

## Task 1 — Database Migration

Create the SQL migration file that adds:
- `owner_id uuid` + `owner_name text` columns to `crm_studios`
- `contract_value numeric(15,2)` + `contract_currency text` columns to `crm_documents`
- Indexes for each

### Files to create/modify
- `supabase/migrations/20260625_bd_enhancement.sql` (new)

### Implementation

Create `supabase/migrations/20260625_bd_enhancement.sql` with exactly this content:

```sql
-- BD Dashboard Enhancement: studio owner + contract value
-- 2026-06-24

-- Feature 1: Studio owner assignment
ALTER TABLE crm_studios
  ADD COLUMN IF NOT EXISTS owner_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name text;

CREATE INDEX IF NOT EXISTS crm_studios_owner_id_idx ON crm_studios (owner_id);

-- Feature 3: Contract value on documents
ALTER TABLE crm_documents
  ADD COLUMN IF NOT EXISTS contract_value    numeric(15, 2),
  ADD COLUMN IF NOT EXISTS contract_currency text NOT NULL DEFAULT 'USD'
    CHECK (contract_currency IN ('USD', 'VND'));

CREATE INDEX IF NOT EXISTS crm_documents_contract_idx
  ON crm_documents (created_by, doc_type)
  WHERE doc_type = 'contract';
```

### Verification
- File exists and matches the SQL above exactly (no extra text)
- `npm run build` still passes (no TypeScript compilation affected by this task)

---

## Task 2 — Service Layer + TypeScript Types

Update types and service files to support the new DB columns.

### Files to modify
- `src/types.ts` (or wherever `CrmStudio` and `CrmDocument` types are defined)
- `apps/crm/services/studioService.ts`
- `apps/crm/services/crmService.ts`

### 2a — TypeScript Types

Find `CrmStudio` interface and add:
```typescript
owner_id?: string | null;
owner_name?: string | null;
```

Find `CrmDocument` interface and add:
```typescript
contract_value?: number | null;
contract_currency?: 'USD' | 'VND' | null;
```

### 2b — studioService.ts

Add function `assignStudioOwner`:
```typescript
export async function assignStudioOwner(
  studioId: number,
  ownerId: string,
  ownerName: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_studios')
    .update({ owner_id: ownerId, owner_name: ownerName })
    .eq('id', studioId);
  if (error) throw error;
}
```

### 2c — crmService.ts

Add function `fetchApprovedContracts`:
```typescript
export async function fetchApprovedContracts(): Promise<Array<{
  id: number;
  created_by: string;
  contract_value: number | null;
  contract_currency: string | null;
}>> {
  const { data, error } = await supabase
    .from('crm_documents')
    .select('id, created_by, contract_value, contract_currency')
    .eq('doc_type', 'contract')
    .eq('approval_status', 'approved');
  if (error) throw error;
  return data ?? [];
}
```

Extend `createDocument` and `updateDocument` (if they exist) to pass through `contract_value` and `contract_currency` fields in the payload. If the functions build the payload object explicitly, add these two fields. If they spread the whole input, no change needed.

### Verification
- `npm run build` passes — TypeScript compiles cleanly with no new errors

---

## Task 3 — StudiosTab UI: Owner Assignment Column

Add an "Assign BD" column to the studios table in `StudiosTab.tsx`.

### Files to modify
- `apps/crm/components/StudiosTab.tsx`

### Requirements
- Add a new column header "BD phụ trách" to the studios table
- Per row: if `studio.owner_name` is set, show a small badge with the name
- If not set, show a dropdown (`<select>`) populated with BD users (role includes 'bd') from `account_users` table
- On selection change: call `assignStudioOwner(studio.id, selectedUserId, selectedUserName)` — optimistic update: set `studio.owner_name` in local state immediately
- If already assigned, show name badge with a small "×" or "Đổi" button to reset/change; clicking it shows the dropdown again
- Fetch BD users once on component mount using Supabase: `supabase.from('account_users').select('id, full_name, role').ilike('role', '%bd%')`
- Follow the style guide for badge and select styling (dark theme, orange accent)

### Verification
- `npm run build` passes
- The column appears in StudiosTab table markup
- `assignStudioOwner` is imported and called on selection

---

## Task 4 — BdDashboard UI: Date Filter + KPI Cards + BD Table Columns

The largest task. Enhance `BdDashboard.tsx` with three feature additions.

### Files to modify
- `apps/crm/components/BdDashboard.tsx`

### 4a — Date Range Filter (Feature 2)

Add preset date filter state:
```typescript
type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'all';
const [preset, setPreset] = useState<DatePreset>('this_month');
```

Add helper to compute date range from preset (pure function, add near top of file or in a utils block):
```typescript
function getDateRange(preset: DatePreset): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (preset === 'all') return { start: null, end: null };
  if (preset === 'this_month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start, end };
  }
  // this_quarter
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3, 1);
  return { start, end: now };
}
```

Filter logic (in-memory, after data loads):
- Won deals: filter by `actual_close_date` within range
- Active deals: filter by `created_at` within range
- Activities: re-fetch with date range, OR filter in-memory by `activity_date`

UI: chip row below the "Xin chào" heading, above KPI cards:
```
[Tháng này]  [Tháng trước]  [Quý này]  [Tất cả]
```
Active chip: `background: #FF9500, color: #000, border-radius: 9999px`
Inactive chip: `background: transparent, color: #aaa, border: 1px solid #333, border-radius: 9999px`

### 4b — Studios KPI Card (Feature 1)

- Fetch `crm_studios` where `owner_id = currentUser.id` (use the supabase client + auth user)
- Count result as `myStudiosCount`
- Add 5th KPI card: title "Studios của tôi", value `myStudiosCount`, icon: building/studio icon or 🏢

### 4c — Contract KPI Card + BD Table Column (Feature 3)

- Fetch `fetchApprovedContracts()` in the dashboard `useEffect`
- Aggregate: total contract value across all BDs → `totalContractValue`
- Per BD aggregate: sum of `contract_value` where `created_by = bd.user_id` → add to `bdPerf` computation
- KPI card: "Hợp đồng", value = formatted `totalContractValue` (e.g. `$12,500` or `12,500 USD`)
- BD Performance table: add "Contract" column showing per-BD contract total, styled green (`color: #22c55e`)

### Verification
- `npm run build` passes
- Date chips render and are togglable (check markup)
- Studios KPI card present
- Contract KPI card present
- BD table has Contract column

---

## Task 5 — Document Form: Contract Value Input (Feature 3, Option A)

Add optional contract value fields to the document creation/edit form when `doc_type = 'contract'`.

### Files to modify
- The component that renders the document creation/edit form (find it — likely `apps/crm/components/` — search for where `doc_type` select or `crm_documents` insert appears)

### Requirements
- When `doc_type === 'contract'`, show two additional optional fields below the existing fields:
  1. "Giá trị hợp đồng" — numeric input (type="number", min=0, step="0.01"), placeholder "0.00"
  2. "Đơn vị tiền tệ" — select with options: `USD` (default), `VND`
- These fields are optional; if left blank, submit `null` for `contract_value`
- Pass `contract_value` and `contract_currency` to `createDocument()` / `updateDocument()`
- Follow style guide for input/select styling

### Verification
- `npm run build` passes
- Fields appear conditionally when doc_type is 'contract'
- Values are included in the submit payload

---

## Summary of Files Touched

| File | Task |
|------|------|
| `supabase/migrations/20260625_bd_enhancement.sql` | Task 1 (new) |
| `src/types.ts` (or equivalent) | Task 2 |
| `apps/crm/services/studioService.ts` | Task 2 |
| `apps/crm/services/crmService.ts` | Task 2 |
| `apps/crm/components/StudiosTab.tsx` | Task 3 |
| `apps/crm/components/BdDashboard.tsx` | Task 4 |
| Document form component (TBD) | Task 5 |
