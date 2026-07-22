-- 20260722090000_crm_activity_attribution.sql
alter table crm_activities
  add column if not exists deal_id uuid references crm_deals(id) on delete set null,
  add column if not exists actor_id uuid references auth.users(id) on delete set null;
create index if not exists idx_crm_activities_deal_id on crm_activities(deal_id);
create index if not exists idx_crm_activities_actor_id on crm_activities(actor_id);
