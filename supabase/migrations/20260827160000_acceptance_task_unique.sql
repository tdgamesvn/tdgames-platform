-- Một task chỉ được nằm trong ĐÚNG MỘT phiếu nghiệm thu.
-- Trước đó chỉ có lọc phía app (`fetchAcceptedTaskIds`) và nó đã hụt một lần:
-- task `[2D Animation] [Character] Wakko Warner` ($960, clickup 86ewyuf0w) lọt vào cả
-- phiếu ORCA/KABAM T3/2026 (0e1ab592) lẫn T4/2026 (ccb3737f), cả hai đã accepted và khách
-- đã thanh toán ⇒ sếp chốt KHÔNG động vào dữ liệu cũ (2026-08-27).
--
-- Nên đây là UNIQUE index PARTIAL: loại trừ đúng phiếu T3 lịch sử để index tạo được mà
-- không phải xoá dòng nào. Mọi phiếu khác (kể cả phiếu tương lai) bị chặn cứng ở DB.
CREATE UNIQUE INDEX IF NOT EXISTS wf_acceptance_task_unique
  ON public.wf_project_acceptance_tasks (task_id)
  WHERE acceptance_id <> '0e1ab592-4037-44aa-92a4-268de2ab9d23';
