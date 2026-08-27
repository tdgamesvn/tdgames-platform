-- wf_tasks: 1 clickup_task_id = 1 dòng. Ép bằng DB, không tin code nữa.
--
-- Bug: cả 3 nơi ghi (TaskList.handleSync, edge clickup-webhook, edge clickup-auto-sync)
-- đều làm SELECT-rồi-INSERT. ClickUp bắn 2 webhook cách nhau vài ms cho cùng 1 task
-- (taskCreated + taskUpdated/assignee) ⇒ 2 lần chạy song song, cả hai SELECT đều thấy
-- rỗng, cả hai cùng INSERT. Kết quả: 11 task nhân đôi từ 2026-08-19 → 08-26, ngày nào
-- cũng thêm, $1.950 giá khách ma (2 cặp `approved` = doanh thu dự kiến đếm 2 lần).
-- Guard `existingRows.length > 1` trong code không chặn được (nó chạy SAU khi trùng rồi),
-- chỉ khiến 11 task đó bị sync bỏ qua im lặng.
--
-- Dọn: giữ dòng đã có phiếu nghiệm thu / quyết toán trước, sau đó tới dòng cũ nhất.
-- Dòng bị xoá kéo theo assignee (FK CASCADE) — đã kiểm: 11 cặp hiện tại đều là bản sao
-- y hệt, không cặp nào dính phiếu, nên không mất dữ liệu tay.
with ranked as (
  select
    t.id,
    row_number() over (
      partition by t.clickup_task_id
      order by
        (exists (select 1 from wf_project_acceptance_tasks p where p.task_id = t.id)) desc,
        (exists (select 1 from wf_settlement_tasks s where s.task_id = t.id)) desc,
        t.created_at
    ) as rn
  from wf_tasks t
  where t.clickup_task_id is not null
)
delete from wf_tasks where id in (select id from ranked where rn > 1);

-- NULL không xung đột với NULL trong Postgres ⇒ task nhập tay (clickup_task_id null)
-- vẫn tạo thoải mái.
alter table wf_tasks
  add constraint wf_tasks_clickup_task_id_key unique (clickup_task_id);
