-- Lỗ #4: rate freelancer nằm trên hr_employees → policy hr_admin_hr_full cho HR đọc qua API
-- (RLS lọc dòng, không lọc cột). Tách sang bảng con admin/ke_toan, mirror hr_employee_salary.
-- ĐÃ APPLY REMOTE 2026-08-09. Bước drop cột cũ nằm ở migration 20260809120000 (chạy SAU khi deploy code).
create table if not exists public.hr_employee_rate (
  employee_id   uuid primary key references public.hr_employees(id) on delete cascade,
  rate_amount   numeric not null default 0,
  rate_currency text    not null default 'USD',
  rate_type     text    not null default '',
  updated_at    timestamptz not null default now()
);

alter table public.hr_employee_rate enable row level security;

create policy hr_employee_rate_admin_full on public.hr_employee_rate
  for all to authenticated using (jwt_has_any_role(array['admin'])) with check (jwt_has_any_role(array['admin']));

create policy hr_employee_rate_ke_toan_read on public.hr_employee_rate
  for select to authenticated using (jwt_has_any_role(array['ke_toan']));

-- Copy dữ liệu đang có (chỉ dòng thực sự có rate — khỏi tạo 17 dòng rỗng)
insert into public.hr_employee_rate (employee_id, rate_amount, rate_currency, rate_type)
select id, coalesce(rate_amount,0), coalesce(nullif(rate_currency,''),'USD'), coalesce(rate_type,'')
from public.hr_employees
where coalesce(rate_amount,0) > 0
on conflict (employee_id) do nothing;
