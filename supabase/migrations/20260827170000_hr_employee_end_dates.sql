-- Ngày nghỉ việc của nhân viên — đọc từ dữ liệu ĐÃ CÓ, không thêm cột mới.
--
-- Duyệt đơn thôi việc (`changeRequestService.ts:293`) ghi sẵn:
--   hr_position_history(new_value='inactive', effective_date = ngày nghỉ)
-- Chỉ là chưa ai nối nó vào bảng chấm công / bảng lương.
--
-- ponytail: một VIEW thay vì thêm `hr_employees.end_date` — không nhân bản nguồn sự thật,
-- không phải backfill, không phải sửa form HR. Đổi lại: nhân viên bị sửa tay ô Trạng thái
-- (không qua đơn) sẽ KHÔNG có ngày ở đây ⇒ phía client phải chịu được end_date = null.
--
-- Nghỉ rồi quay lại làm: lấy bản ghi 'inactive' mới nhất là đủ — nếu đã quay lại thì
-- hr_employees.status hiện tại là 'active' nên không ai lọc họ ra cả.

CREATE OR REPLACE VIEW public.hr_employee_end_dates
WITH (security_invoker = true) AS   -- RLS của hr_position_history vẫn được áp dụng
SELECT employee_id,
       max(effective_date) AS end_date
FROM   public.hr_position_history
WHERE  new_value = 'inactive'
  AND  effective_date IS NOT NULL
GROUP  BY employee_id;

COMMENT ON VIEW public.hr_employee_end_dates IS
  'Ngay nghi viec suy ra tu hr_position_history (don thoi viec da duyet). NULL = bi sua tay o Trang thai, khong biet ngay.';

GRANT SELECT ON public.hr_employee_end_dates TO authenticated;
