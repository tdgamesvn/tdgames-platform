-- BD Targets: quota theo quý cho từng BD ('YYYY-Qn'), tách theo entity (2 sổ).
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
-- Admin/ke_toan check copy từ 20260713100000_outreach_lead_ownership.sql
create policy bd_targets_select on crm_bd_targets for select to authenticated
  using (bd_id = auth.uid() or jwt_has_any_role(ARRAY['admin', 'ke_toan']));
create policy bd_targets_admin_all on crm_bd_targets for all to authenticated
  using (jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  with check (jwt_has_any_role(ARRAY['admin', 'ke_toan']));
