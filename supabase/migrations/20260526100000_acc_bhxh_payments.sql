-- ══════════════════════════════════════════════════════════════
-- acc_bhxh_payments: Theo dõi trạng thái nộp BHXH hàng tháng
-- Kế toán đánh dấu đã nộp (upsert on month+year)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.acc_bhxh_payments (
  id           uuid primary key default gen_random_uuid(),
  month        smallint     not null check (month between 1 and 12),
  year         smallint     not null check (year between 2020 and 2100),
  total_amount numeric(18,0) not null default 0,
  paid_date    date         not null,
  paid_by      text         not null default '',
  notes        text         not null default '',
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint acc_bhxh_payments_month_year_key unique (month, year)
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Only create trigger if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_acc_bhxh_payments_updated_at'
  ) then
    create trigger trg_acc_bhxh_payments_updated_at
      before update on public.acc_bhxh_payments
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- RLS
alter table public.acc_bhxh_payments enable row level security;

-- Kế toán (role = 'accountant' hoặc 'admin') được đọc + ghi
create policy "acc_bhxh_payments_select" on public.acc_bhxh_payments
  for select using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'accountant', 'hr')
  );

create policy "acc_bhxh_payments_insert" on public.acc_bhxh_payments
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'accountant')
  );

create policy "acc_bhxh_payments_update" on public.acc_bhxh_payments
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'accountant')
  );

create policy "acc_bhxh_payments_delete" on public.acc_bhxh_payments
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'accountant')
  );

-- Grant access to authenticated role (Data API)
grant select, insert, update, delete on public.acc_bhxh_payments to authenticated;
