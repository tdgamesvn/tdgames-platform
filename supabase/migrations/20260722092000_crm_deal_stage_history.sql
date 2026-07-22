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

-- INSERT phải là AFTER (row phải tồn tại trước khi history FK trỏ vào);
-- UPDATE phải là BEFORE (để mutate new.stage_entered_at).
drop trigger if exists trg_crm_deal_stage on crm_deals;
create trigger trg_crm_deal_stage before update on crm_deals
for each row execute function crm_log_deal_stage();

drop trigger if exists trg_crm_deal_stage_ins on crm_deals;
create trigger trg_crm_deal_stage_ins after insert on crm_deals
for each row execute function crm_log_deal_stage();
