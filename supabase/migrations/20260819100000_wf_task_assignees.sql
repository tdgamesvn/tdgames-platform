-- Bước 1 — Bảng con `wf_task_assignees`: 1 task = 1 dòng, nhiều người = nhiều assignee.
--
-- Vì sao: `wf_tasks.worker_id` chỉ chứa 1 người ⇒ sync ClickUp tách task nhiều người
-- thành nhiều dòng `wf_tasks`, mỗi dòng mang đủ `client_price` ⇒ doanh thu đếm 2 lần.
-- Và quyết toán cho người A set `wf_tasks.payment_status='paid'` ⇒ người B bị lọc mất,
-- không bao giờ quyết toán được phần của mình.
--
-- Migration này KHÔNG sửa dòng dữ liệu cũ nào: chỉ tạo bảng mới + copy sang.
-- `wf_tasks.worker_id` giữ nguyên, drop ở migration cuối sau khi code deploy xong.

create table if not exists public.wf_task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.wf_tasks(id)   on delete cascade,
  worker_id uuid not null references public.wf_workers(id) on delete cascade,
  share_pct numeric not null default 100 check (share_pct >= 0 and share_pct <= 100),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  created_at timestamptz default now(),
  unique (task_id, worker_id)
);

create index if not exists idx_wf_task_assignees_task   on public.wf_task_assignees(task_id);
create index if not exists idx_wf_task_assignees_worker on public.wf_task_assignees(worker_id);

-- Backfill TRƯỚC khi tạo trigger (khỏi ghi lại wf_tasks 347 lần cho ra đúng giá trị cũ).
-- Dòng trùng `86ewyuf0w` cứ để nguyên 2 task, mỗi task 1 assignee 100% — sếp chốt bỏ qua.
insert into public.wf_task_assignees (task_id, worker_id, share_pct, payment_status)
select t.id, t.worker_id, 100, coalesce(t.payment_status, 'unpaid')
from public.wf_tasks t
where t.worker_id is not null
on conflict (task_id, worker_id) do nothing;

-- `wf_tasks.payment_status` giữ lại, do trigger tự set ⇒ 8 chỗ chỉ-đọc (CEO dashboard,
-- edge function platform-data + billing-report, badge/filter TaskList) không phải sửa.
-- ponytail: trần đã biết — task trả 1 phần thì dashboard vẫn tính nguyên `price` vào
-- "workforce payable". Nâng cấp khi cần: cộng theo share_pct của assignee chưa paid.
create or replace function public.sync_task_payment_status()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare tid uuid := coalesce(new.task_id, old.task_id);
begin
  update public.wf_tasks t set payment_status = case
    when exists (select 1 from public.wf_task_assignees a
                 where a.task_id = tid and a.share_pct > 0 and a.payment_status <> 'paid')
      then 'unpaid'
    when exists (select 1 from public.wf_task_assignees a
                 where a.task_id = tid and a.share_pct > 0)
      then 'paid'
    else t.payment_status end
  where t.id = tid;
  return null;
end $$;
revoke all on function public.sync_task_payment_status() from public, anon, authenticated;

drop trigger if exists trg_sync_task_payment_status on public.wf_task_assignees;
create trigger trg_sync_task_payment_status
after insert or update or delete on public.wf_task_assignees
for each row execute function public.sync_task_payment_status();

-- RLS: y hệt lối của wf_settlement_tasks — staff toàn quyền, worker chỉ đọc dòng của mình.
alter table public.wf_task_assignees enable row level security;

drop policy if exists wf_task_assignees_staff_all  on public.wf_task_assignees;
create policy wf_task_assignees_staff_all on public.wf_task_assignees for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists wf_task_assignees_self_read on public.wf_task_assignees;
create policy wf_task_assignees_self_read on public.wf_task_assignees for select to authenticated
  using (worker_id = public.my_worker_id());

-- Freelancer đọc task của mình: chuyển từ wf_tasks.worker_id sang assignee.
-- Backfill ở trên đảm bảo mọi task đang đọc được vẫn đọc được (347/347 task có worker_id).
drop policy if exists wf_tasks_self_read on public.wf_tasks;
create policy wf_tasks_self_read on public.wf_tasks for select to authenticated
  using (exists (
    select 1 from public.wf_task_assignees a
    where a.task_id = wf_tasks.id and a.worker_id = public.my_worker_id()
  ));

-- Chống trùng chuyển sang tầng sync (bước 4): 1 clickup_task_id chỉ upsert 1 dòng.
-- ponytail: unique index trên clickup_task_id chờ dọn dòng trùng lịch sử (86ewyuf0w
-- còn 2 dòng nên tạo unique sẽ fail). Bật lại khi sếp muốn dọn.
drop index if exists public.uq_wf_tasks_clickup_worker;
create index if not exists idx_wf_tasks_clickup_task_id
  on public.wf_tasks(clickup_task_id) where clickup_task_id is not null and clickup_task_id <> '';
