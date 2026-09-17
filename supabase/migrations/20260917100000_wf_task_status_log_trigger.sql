-- Ghi lịch sử status task bằng trigger DB thay vì ở client.
-- Lý do: 20260910150000 chỉ ghi log ở nút Sync tay (TaskList.tsx). Nhưng clickup-webhook (gần realtime)
-- và clickup-auto-sync (cron 2 lần/ngày) luôn cập nhật clickup_status TRƯỚC ⇒ lúc bấm Sync tay status cũ = mới
-- ⇒ 0 dòng log sau 6 ngày, không task nào bị trừ điểm FIX. Trigger bắt mọi nguồn ghi.
create or replace function public.log_wf_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wf_task_status_log (task_id, from_status, to_status, source)
  values (
    new.id,
    nullif(old.clickup_status, ''),
    new.clickup_status,
    case when auth.role() = 'service_role' or auth.role() is null then 'trigger_service' else 'trigger_user' end
  );
  return null;
end;
$$;

revoke all on function public.log_wf_task_status_change() from public, anon, authenticated;

drop trigger if exists trg_log_wf_task_status on public.wf_tasks;
create trigger trg_log_wf_task_status
  after update of clickup_status on public.wf_tasks
  for each row
  -- So sánh không phân biệt hoa/thường, '' ≡ null; status mới rỗng thì bỏ (to_status NOT NULL).
  when (
    coalesce(new.clickup_status, '') <> ''
    and lower(coalesce(old.clickup_status, '')) is distinct from lower(coalesce(new.clickup_status, ''))
  )
  execute function public.log_wf_task_status_change();
