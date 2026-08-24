-- BUG CÓ SẴN: handle_leave_request_status_change() trừ ngày phép cho MỌI đơn được duyệt,
-- không phân biệt request_type. Đơn không phải nghỉ phép (forgot / late / early / overtime)
-- không có leave_days nên bị COALESCE thành 1 ngày ⇒ duyệt là trừ oan 1 ngày phép, hoặc chặn
-- bằng "Không đủ ngày phép. Còn lại 0 ngày, yêu cầu 1.0 ngày" nếu nhân viên đã hết phép.
--
-- Hai trigger anh em trên cùng bảng (notify_leave_new, notify_leave_status_change) đều mở đầu
-- bằng `IF NEW.request_type <> 'leave' THEN RETURN NEW; END IF;` — riêng cái trừ phép quên.
--
-- Chặn bằng WHEN ở tầng trigger thay vì sửa thân hàm: logic trừ/hoàn phép phức tạp, không đụng
-- vào thì không có cơ hội chép sai. Hàm giữ nguyên, chỉ thôi được gọi cho đơn không phải phép.
DROP TRIGGER IF EXISTS trg_leave_request_status ON public.att_requests;
CREATE TRIGGER trg_leave_request_status
  AFTER UPDATE OF status ON public.att_requests
  FOR EACH ROW
  WHEN (NEW.request_type = 'leave')
  EXECUTE FUNCTION handle_leave_request_status_change();
