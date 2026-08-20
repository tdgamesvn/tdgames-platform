-- Mốc "task chuyển động lần cuối" lấy từ ClickUp date_updated.
-- Cột updated_at của DB bị updateTask ghi đè mỗi lần bấm Sync nên không dùng để
-- phân tháng được; task chưa done (client_review…) lại không có date_done.
alter table public.wf_tasks add column if not exists clickup_updated_at date;
comment on column public.wf_tasks.clickup_updated_at is
  'ClickUp date_updated (ngày task chuyển động lần cuối). Dùng làm mốc phân tháng cho task chưa có date_done.';
create index if not exists idx_wf_tasks_clickup_updated_at on public.wf_tasks (clickup_updated_at);

-- Backfill tạm để dashboard không bị trống trước lần Sync đầu tiên; Sync sẽ ghi đè
-- bằng ngày thật từ ClickUp.
update public.wf_tasks set clickup_updated_at = coalesce(completed_at, closed_date, updated_at::date)
where clickup_updated_at is null;
