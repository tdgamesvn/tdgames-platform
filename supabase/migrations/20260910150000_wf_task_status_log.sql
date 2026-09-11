-- Lịch sử đổi status task (ghi khi bấm Sync ClickUp, từ lúc deploy trở đi).
-- Dùng đếm số lần task bị trả về 'FIX' ⇒ trừ giá trị hiệu suất của nhân sự
-- (doanh thu công ty giữ nguyên). Sếp chốt 2026-09-10: lần FIX đầu miễn, từ lần 2 trừ 5%/lần, trần 30%.
create table if not exists public.wf_task_status_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wf_tasks(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  source text not null default 'clickup_sync'
);

create index if not exists wf_task_status_log_task_idx on public.wf_task_status_log (task_id);

alter table public.wf_task_status_log enable row level security;

drop policy if exists wf_task_status_log_staff_all on public.wf_task_status_log;
create policy wf_task_status_log_staff_all on public.wf_task_status_log
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists wf_task_status_log_read on public.wf_task_status_log;
create policy wf_task_status_log_read on public.wf_task_status_log
  for select using (auth.role() = 'authenticated');

alter table public.wf_kpi_settings
  add column if not exists fix_penalty_step numeric not null default 5,   -- % trừ mỗi lần FIX
  add column if not exists fix_penalty_free integer not null default 1,   -- số lần FIX đầu không trừ
  add column if not exists fix_penalty_cap numeric not null default 30;   -- trần % trừ
