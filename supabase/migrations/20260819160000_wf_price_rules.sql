-- Bảng giá theo loại việc: task sync từ ClickUp về được tự điền giá khách + giá trả
-- người làm, thay vì gõ tay từng task (94% task đang trống client_price).
--
-- Auto-điền nằm ở TRIGGER BEFORE INSERT trên wf_tasks — mọi đường vào đều đi qua đây
-- (webhook, cron auto-sync, nút sync tay, tạo tay), khỏi phải sửa 4 chỗ.
-- Chỉ điền khi giá đang = 0 ⇒ giá sếp chỉnh tay KHÔNG bao giờ bị đè, kể cả khi sync lại.

create table if not exists public.wf_price_rules (
  id uuid primary key default gen_random_uuid(),
  label text not null,                          -- tên gợi nhớ, vd "2D Animation - Character"
  space_name text,                              -- null = khớp mọi space
  folder_name text,                             -- null = khớp mọi folder
  list_name text,                               -- null = khớp mọi list
  title_pattern text,                           -- ILIKE, vd '%[Character]%'. null = mọi task
  client_price numeric(14,2),                   -- giá thu khách; null = không điền
  client_currency text default 'USD',
  price numeric(14,2),                          -- giá trả người làm; null = không điền
  currency text default 'VND',
  priority integer not null default 0,          -- rule cụ thể hơn thì để priority cao hơn
  active boolean not null default true,
  entity text not null default 'TD GAMES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.wf_price_rules is
  'Đơn giá mặc định theo space/folder/list/tên task. Áp lúc INSERT wf_tasks, chỉ khi giá trống.';

create index if not exists idx_wf_price_rules_lookup
  on public.wf_price_rules (active, priority desc);

alter table public.wf_price_rules enable row level security;

create policy wf_price_rules_staff_all on public.wf_price_rules
  for all using (public.is_staff()) with check (public.is_staff());

-- ── Trigger auto-điền ────────────────────────────────────────────────────────
create or replace function public.apply_wf_price_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  -- Đã có đủ 2 giá thì khỏi tra bảng.
  if coalesce(new.client_price, 0) > 0 and coalesce(new.price, 0) > 0 then
    return new;
  end if;

  select * into r
  from public.wf_price_rules pr
  where pr.active
    and (pr.space_name  is null or pr.space_name  = new.clickup_space_name)
    and (pr.folder_name is null or pr.folder_name = new.clickup_folder_name)
    and (pr.list_name   is null or pr.list_name   = new.clickup_list_name)
    and (pr.title_pattern is null or new.title ilike pr.title_pattern)
  order by pr.priority desc, pr.created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  if coalesce(new.client_price, 0) = 0 and r.client_price is not null then
    new.client_price := r.client_price;
    new.client_currency := coalesce(r.client_currency, new.client_currency);
  end if;

  if coalesce(new.price, 0) = 0 and r.price is not null then
    new.price := r.price;
    new.currency := coalesce(r.currency, new.currency);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_wf_price_rule on public.wf_tasks;
create trigger trg_apply_wf_price_rule
  before insert on public.wf_tasks
  for each row execute function public.apply_wf_price_rule();

-- ── Áp bảng giá cho task CŨ đang trống giá ───────────────────────────────────
-- Gọi tay từ UI (nút "Áp bảng giá cho task chưa có giá"). Không tự chạy để tránh
-- bất ngờ; chỉ đụng task có giá = 0 nên không đè số đã nhập.
create or replace function public.backfill_wf_task_prices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  r record;
  touched integer := 0;
begin
  if not public.is_staff() then
    raise exception 'chi admin/ke_toan duoc ap bang gia';
  end if;

  for t in
    select * from public.wf_tasks
    where coalesce(client_price, 0) = 0 or coalesce(price, 0) = 0
  loop
    select * into r
    from public.wf_price_rules pr
    where pr.active
      and (pr.space_name  is null or pr.space_name  = t.clickup_space_name)
      and (pr.folder_name is null or pr.folder_name = t.clickup_folder_name)
      and (pr.list_name   is null or pr.list_name   = t.clickup_list_name)
      and (pr.title_pattern is null or t.title ilike pr.title_pattern)
    order by pr.priority desc, pr.created_at desc
    limit 1;

    if found then
      update public.wf_tasks set
        client_price = case when coalesce(t.client_price, 0) = 0 and r.client_price is not null
                            then r.client_price else client_price end,
        client_currency = case when coalesce(t.client_price, 0) = 0 and r.client_price is not null
                            then coalesce(r.client_currency, client_currency) else client_currency end,
        price = case when coalesce(t.price, 0) = 0 and r.price is not null
                            then r.price else price end,
        currency = case when coalesce(t.price, 0) = 0 and r.price is not null
                            then coalesce(r.currency, currency) else currency end,
        updated_at = now()
      where id = t.id;
      touched := touched + 1;
    end if;
  end loop;

  return touched;
end;
$$;

revoke all on function public.backfill_wf_task_prices() from public, anon;
grant execute on function public.backfill_wf_task_prices() to authenticated;
