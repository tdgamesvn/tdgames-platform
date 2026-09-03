-- Loại trừ space / folder / list ClickUp khỏi sync Workforce (theo TÊN, khớp chính xác).
-- Sync bỏ qua list thuộc mục bị loại; tab Task ẩn luôn task cũ đã lỡ sync (không xoá data).
create table if not exists public.wf_sync_exclusions (
  kind text not null check (kind in ('space', 'folder', 'list')),
  name text not null,
  created_at timestamptz not null default now(),
  primary key (kind, name)
);

comment on table public.wf_sync_exclusions is
  'ClickUp space/folder/list bị loại khỏi sync Workforce. kind + name khớp chính xác.';

alter table public.wf_sync_exclusions enable row level security;

drop policy if exists wf_sync_exclusions_staff_all on public.wf_sync_exclusions;
create policy wf_sync_exclusions_staff_all on public.wf_sync_exclusions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists wf_sync_exclusions_read on public.wf_sync_exclusions;
create policy wf_sync_exclusions_read on public.wf_sync_exclusions
  for select using (auth.role() = 'authenticated');
