-- KPI settings cho Workforce Financial Dashboard (chỉ tham khảo, không đẩy vào payroll)
-- Global default: 1 row employee_id NULL. Override per nhân viên: row có employee_id.
create table if not exists wf_kpi_settings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid unique references hr_employees(id) on delete cascade,
  multiplier numeric not null default 3,        -- target = gross_actual × multiplier
  bonus_percent numeric not null default 20,    -- thưởng = phần dư × bonus_percent%
  updated_at timestamptz not null default now()
);

alter table wf_kpi_settings enable row level security;

create policy "wf_kpi_settings_authenticated_all" on wf_kpi_settings
  for all to authenticated using (true) with check (true);

-- Seed global default (3x, 20%) nếu chưa có
insert into wf_kpi_settings (employee_id, multiplier, bonus_percent)
select null, 3, 20
where not exists (select 1 from wf_kpi_settings where employee_id is null);
