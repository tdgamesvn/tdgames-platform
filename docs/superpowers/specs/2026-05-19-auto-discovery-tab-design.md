# Auto Discovery Tab — Design Spec

_Date: 2026-05-19_  
_Status: Approved by user_

---

## Problem

The Email Outreach system has two separate automation flows:
1. **Auto Batch** — sends emails daily from existing leads (working, config UI in DashboardTab)
2. **Discovery** — finds studios/contacts via Apollo.io (manual-only, no scheduling)

There is no UI to schedule and configure automatic country-rotation discovery. The user must manually search countries one by one. Credits are wasted if we can't pre-check which studios were already discovered.

---

## Solution

Add a new **🤖 Auto** sub-tab to EmailOutreach containing:
- **Auto Discovery section** — scheduled country-rotation discovery with credit pacing and deduplication
- **Auto Batch section** — moved from DashboardTab (same functionality, cleaner home)

DashboardTab keeps a small summary card linking to the Auto tab.

---

## Section 1: Architecture & Data Model

### Supabase Config (`crm_outreach_config`, key = `auto_discovery`)

```json
{
  "enabled": false,
  "countries": ["United States", "Canada", "Singapore", "Switzerland"],
  "monthly_credits": 1000,
  "studios_per_run": 5,
  "re_discover_after_days": 90,
  "current_country_index": 0,
  "current_page": 1,
  "last_run_at": null,
  "last_run_country": null,
  "last_run_stats": {
    "studios_searched": 0,
    "contacts_added": 0,
    "skipped_studio": 0,
    "skipped_email": 0
  }
}
```

**Computed (not stored):**
- `daily_budget = Math.floor(monthly_credits / 30)` — shown in UI
- `estimated_contacts_per_day = studios_per_run × 3` — informational

### New DB Table: `crm_discovered_studios`

```sql
CREATE TABLE crm_discovered_studios (
  apollo_id       text PRIMARY KEY,
  studio_name     text NOT NULL,
  country         text NOT NULL,
  contacts_found  integer DEFAULT 0,
  discovered_at   timestamptz DEFAULT now()
);
```

### Country Rotation Logic

```
countries = ["US", "Canada", "Singapore", "Switzerland"]
current_country_index = 0  → process "US", page = current_page
After run: advance page by 1
When country exhausted (no more results): increment country_index, reset page to 1
When country_index = countries.length: reset to 0 (loop)
```

---

## Section 2: Deduplication Strategy

**Layer 1 — Studio level (pre-API, saves credits):**
- Query `crm_discovered_studios` for all apollo_ids
- If studio's apollo_id found AND `discovered_at > now() - re_discover_after_days` → SKIP (don't call contact API)
- If older than N days → re-discover (catches new hires)

**Layer 2 — Email level (post-API, safety net):**
- After getting contacts from Apollo, filter emails already in `crm_outreach_leads`
- Insert only new emails. Use `onConflict: 'email', ignoreDuplicates: true` as final safety net

**Result:** Credits spent only on studios never discovered (or discovered >90 days ago).

---

## Section 3: New Edge Function

**`supabase/functions/outreach-auto-discovery/index.ts`**
- Same proxy pattern as `outreach-auto-batch`
- Forwards POST to FastAPI `/api/discovery/auto-run`
- Payload: `{ country, page, studios_per_run, existing_apollo_ids[], existing_emails[] }`
- Edge function builds exclusion lists by querying Supabase before forwarding

**FastAPI `/api/discovery/auto-run` (backend — out of frontend scope):**
- Searches Apollo for studios by country/page
- Filters studios by exclusion list
- Discovers contacts for non-excluded studios
- Returns: `{ studios_searched, studios_skipped, contacts_found, leads_to_add[], new_apollo_ids[] }`

Edge function then:
1. Inserts `leads_to_add` into `crm_outreach_leads`
2. Inserts `new_apollo_ids` into `crm_discovered_studios`
3. Updates `crm_outreach_config` rotation state + `last_run_stats`

---

## Section 4: UI Layout — AutoTab Component

### Tab registration (EmailOutreach.tsx)
```
SubTab: 'dashboard' | 'leads' | 'discovery' | 'emails' | 'analytics' | 'auto' | 'settings'
Tab entry: { key: 'auto', icon: '🤖', label: 'Auto' }
```

### AutoTab layout (top to bottom)

```
┌─ 🤖 AUTO DISCOVERY ─────────────────────────────────┐
│ Title + enable toggle + [▶ Run Now] button            │
│                                                       │
│ 🌍 COUNTRY ROTATION                                   │
│ [tag pills: ✓US ✓Canada ✓Singapore ✓Switzerland +]    │
│ (click to toggle, from full country list)             │
│                                                       │
│ Next run: 🇺🇸 United States — Page 3                  │
│ Last run: 2026-05-18 09:00 · +12 contacts · 5 studios │
│                                                       │
│ ⚙️ CREDIT CONFIG                                      │
│ [Monthly Credits: 1000] → Daily budget: ~33           │
│ [Studios/run: 5] [Re-discover after: 90 days]         │
│                                                       │
│ [💾 Save Config]                                      │
│                                                       │
│ 📋 RECENT DISCOVERY RUNS (last 10)                    │
│ date | country | studios | added | skipped            │
└─────────────────────────────────────────────────────-┘

─────── divider ───────────────────────────────────────

┌─ 📧 AUTO BATCH EMAIL ────────────────────────────────┐
│ (moved from DashboardTab — same UI, same logic)       │
│ Title + enable toggle + [▶ Send Now] button           │
│ [Batch size] [Daily limit] [Min delay hours]          │
│ Schedule: 7:00 & 14:00 VN                             │
│ Progress bar (when running)                           │
│ Recent batch log                                      │
└──────────────────────────────────────────────────────┘
```

### DashboardTab change
Remove Auto Batch config card. Replace with small summary:
```
🤖 Auto Status: Discovery ON · Batch ON → [Xem cấu hình →]
```

---

## Section 5: Component Changes

| File | Change |
|------|--------|
| `apps/crm/components/EmailOutreach.tsx` | Add `'auto'` to SubTab, add tab entry, render `<AutoTab />`, replace batch card in Dashboard with summary |
| `apps/crm/components/EmailOutreach.tsx` | Add `AutoTab` component (inline or extract to separate file) |
| `supabase/functions/outreach-auto-discovery/index.ts` | New edge function |

---

## Section 6: Supabase Migration

```sql
-- New table for deduplication
CREATE TABLE crm_discovered_studios (
  apollo_id       text PRIMARY KEY,
  studio_name     text NOT NULL,
  country         text NOT NULL,
  contacts_found  integer DEFAULT 0,
  discovered_at   timestamptz DEFAULT now()
);

-- Seed auto_discovery config row
INSERT INTO crm_outreach_config (key, value, updated_at)
VALUES (
  'auto_discovery',
  '{"enabled":false,"countries":[],"monthly_credits":1000,"studios_per_run":5,"re_discover_after_days":90,"current_country_index":0,"current_page":1,"last_run_at":null,"last_run_country":null,"last_run_stats":{"studios_searched":0,"contacts_added":0,"skipped_studio":0,"skipped_email":0}}',
  now()
)
ON CONFLICT (key) DO NOTHING;
```

---

## Out of Scope (Backend)

FastAPI endpoint `/api/discovery/auto-run` must be implemented separately. Frontend will call it via the new edge function proxy. The UI will show an error state if the backend endpoint returns 404/503.

---

## Success Criteria

- [ ] AutoTab renders with country picker, credit config, rotation state display
- [ ] Countries can be added/removed via toggle pills
- [ ] "Run Now" triggers edge function and shows progress
- [ ] Config saves to `crm_outreach_config`
- [ ] Rotation state (current country + page) updates after each run
- [ ] Auto Batch config moved from Dashboard to AutoTab
- [ ] Dashboard shows compact summary with link to AutoTab
- [ ] `crm_discovered_studios` migration applied
- [ ] `outreach-auto-discovery` edge function deployed
