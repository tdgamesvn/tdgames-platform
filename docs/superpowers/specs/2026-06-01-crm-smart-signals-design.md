# CRM Smart Signals — Design Spec

_2026-06-01_

## Goal
Tăng chất lượng leads bằng Apollo Intent Topics, và biết ai đang "nóng" qua engagement counter.

## Scope (2 features)

### Feature 1: Apollo Intent Topics
**File thay đổi:** `/opt/td-mailer-api/services/apollo.py` + `routes/automation.py`

Apollo Basic plan có 6 Intent Topics slots. Studios đang actively research chủ đề được configure trên Apollo dashboard sẽ được tag với intent signal.

- Thêm `organization_intent_topics` filter vào `apollo_search_companies()`
- Khi tìm được company có intent signal → `trigger_source='intent_signal'`, `lead_score=90`
- Cần setup intent topics trong Apollo dashboard trước: "game art outsourcing", "art production", "3D animation"

### Feature 2: Engagement Counter + Hot Lead Alert
**Files thay đổi:**
- DB migration: `open_count INT DEFAULT 0`, `click_count INT DEFAULT 0` → `crm_outreach_leads`
- `/opt/td-mailer-api/routes/webhook.py` → `_handle_engagement()`: increment counter, Discord alert khi open_count ≥ 3
- `types.ts`: thêm `open_count`, `click_count` vào `CrmOutreachLead`

**Hot lead Discord message:** "🔥 [Contact] tại [Studio] đã mở email [N] lần — check ngay\!"

## DB Schema changes
```sql
ALTER TABLE crm_outreach_leads ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE crm_outreach_leads ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
```

## Not in scope
- Claude AI personalization
- Reply detection
- Steam API / Crunchbase (Phase 3)
- SalesQL (redundant with Apollo Waterfall)
