# BD Dashboard Enhancement — Design Spec

_Date: 2026-06-24_

---

## Overview

Enhance the CRM BD Dashboard with three features chosen for the MVP:

| Feature | Status |
|---------|--------|
| 1. Studio owner assignment | In scope |
| 2. Date range filter for BdDashboard | In scope |
| 3. Contract value in BD KPIs | In scope |
| ~~Export báo cáo KPI~~ | Removed from MVP |

---

## Feature 1 — Studio Owner Assignment

### Problem
`crm_studios` has no `owner_id` — studios cannot be assigned to a specific BD. The BD Performance table cannot show how many studios each BD owns.

### Database Migration
```sql
ALTER TABLE crm_studios
  ADD COLUMN owner_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN owner_name text; -- denormalized for fast display without join

CREATE INDEX crm_studios_owner_id_idx ON crm_studios (owner_id);
```

### Service layer
- `studioService.ts`: add `assignStudioOwner(studioId: number, ownerId: string, ownerName: string)` — simple UPDATE
- `fetchStudios()` already returns all columns; no change needed

### UI — StudiosTab
- Add "Assign BD" column to the studios table
- Per studio row: small dropdown listing all users with role `bd` (fetch from `account_users` where role includes bd)
- On selection: call `assignStudioOwner()`, optimistic update in local state
- Show owner avatar/name badge if assigned, "— Chưa gán —" placeholder if not

### UI — BdDashboard
- Add 5th KPI card: **"Studios của tôi"** — count of `crm_studios` where `owner_id = currentUser.id`
- BD Performance table: add **"Studios"** column (integer count per BD)

---

## Feature 2 — Date Range Filter

### Problem
BdDashboard shows all-time data — no way to view this month's or this quarter's performance.

### Approach: Preset selector (4 options)

| Preset | Description |
|--------|-------------|
| Tháng này | `[first day of current month, today]` — **default** |
| Tháng trước | `[first day of last month, last day of last month]` |
| Quý này | `[first day of current quarter, today]` |
| Tất cả | No filter applied |

A custom date picker is out of scope for MVP.

### State
```typescript
type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'all';
const [preset, setPreset] = useState<DatePreset>('this_month');
```

### Filter logic (in-memory — no refetch)
- `fetchDeals()` already loads all deals; filter applied after load
- **Won deals**: filter by `actual_close_date` falling in range
- **Active deals**: filter by `created_at` falling in range
- **Activities**: filter by `activity_date` — already loaded with limit 8; re-fetch with date range params

### UI placement
- Inline chip row below the "Xin chào" heading, above KPI cards
- Four chips: `[Tháng này] [Tháng trước] [Quý này] [Tất cả]`
- Active chip: primary orange fill; inactive: ghost border

---

## Feature 3 — Contract Value in BD KPIs

### Problem
`crm_documents` has no `value` field. Contract monetary value is not tracked anywhere separate from deal value.

### Decision
Add `contract_value` (nullable numeric) to `crm_documents`. This distinguishes **deal forecast value** (from `crm_deals.value`) from **actual signed contract value** (from `crm_documents.contract_value`). Only meaningful when `doc_type = 'contract'`.

### Database Migration
```sql
ALTER TABLE crm_documents
  ADD COLUMN contract_value    numeric(15, 2),
  ADD COLUMN contract_currency text NOT NULL DEFAULT 'USD'
    CHECK (contract_currency IN ('USD', 'VND'));

-- Optional: index for aggregation queries
CREATE INDEX crm_documents_contract_idx
  ON crm_documents (created_by, doc_type)
  WHERE doc_type = 'contract';
```

### Service layer
- `crmService.ts`: add `fetchApprovedContracts()` — fetches `crm_documents` where `doc_type = 'contract'` AND `approval_status = 'approved'`, returns `{ id, created_by, contract_value, contract_currency }`
- Extend `createDocument()` / `updateDocument()` to accept `contract_value` + `contract_currency`

### UI — BdDashboard
- Fetch approved contracts alongside deals + activities in `useEffect`
- Aggregate `contractVal` per BD (by `created_by`) in `bdPerf` computation
- Add **"Contract"** column to BD Performance table (shows sum of approved contract values, styled green)
- Add overview KPI card: **"Hợp đồng"** — total approved contract value across all BD

### UI — Document form (existing)
- When `doc_type = 'contract'`, show optional "Giá trị hợp đồng" numeric input + currency select (USD/VND)
- If not filled in, defaults to null (not shown in KPI)

---

## Files Touched

| File | Change |
|------|--------|
| `supabase/migrations/20260625_bd_enhancement.sql` | New: owner_id + contract_value migrations |
| `apps/crm/services/studioService.ts` | Add `assignStudioOwner()`, update `CrmStudio` type |
| `apps/crm/services/crmService.ts` | Add `fetchApprovedContracts()`, extend create/update |
| `apps/crm/components/StudiosTab.tsx` | Add owner column + assign dropdown |
| `apps/crm/components/BdDashboard.tsx` | Date filter chips, Studios KPI card, Contract KPI card, BD table columns |
| `types.ts` | Add `owner_id`, `owner_name` to `CrmStudio`; add `contract_value`, `contract_currency` to `CrmDocument` |

---

## Out of Scope (MVP)

- Export báo cáo KPI (CSV/Excel)
- KPI targets / quota per BD
- Custom date range picker
- Notification when studio is assigned to BD
