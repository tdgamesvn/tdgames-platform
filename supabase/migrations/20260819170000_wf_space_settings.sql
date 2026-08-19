-- Space nội bộ (marketing, BD, R&D...): có task nhưng không bán cho khách, không
-- nghiệm thu, không có giá. Đánh dấu để dashboard khỏi cảnh báo "task chưa nhập giá".
create table if not exists public.wf_space_settings (
  space_name text primary key,
  is_internal boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);

comment on table public.wf_space_settings is
  'Cấu hình theo ClickUp space. is_internal = việc nội bộ, không kỳ vọng doanh thu.';

alter table public.wf_space_settings enable row level security;

drop policy if exists wf_space_settings_staff_all on public.wf_space_settings;
create policy wf_space_settings_staff_all on public.wf_space_settings
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists wf_space_settings_read on public.wf_space_settings;
create policy wf_space_settings_read on public.wf_space_settings
  for select using (auth.role() = 'authenticated');

insert into public.wf_space_settings (space_name, is_internal, note)
values ('TDGAMES_Team', true, 'Việc nội bộ: marketing, BD, R&D — không bán cho khách')
on conflict (space_name) do nothing;
