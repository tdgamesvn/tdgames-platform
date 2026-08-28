-- Huỷ xác nhận bảng lương còn sót 1 thứ: xác nhận cũ của nhân viên vẫn nằm nguyên.
-- Nhân viên bấm "Xác nhận" trên số CŨ → HR huỷ, sửa số, confirm lại → record vẫn
-- employee_status = 'confirmed' ⇒ nút "Đã trả lương" mở ra (canMarkPaid tính
-- confirmed|resolved) dù chưa ai xem lại số mới.
--
-- Fix: rollback về draft thì hạ 'confirmed'/'resolved' xuống 'pending', xoá mốc thời gian.
-- 'disputed' giữ nguyên — đó là khiếu nại đang mở, hạ xuống pending là giấu cờ đỏ của HR.
-- employee_comment giữ nguyên trong mọi trường hợp (lịch sử, không phải rác).

CREATE OR REPLACE FUNCTION public.notify_payroll_withdrawn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.notifications
  SET type    = 'payslip_withdrawn',
      title   = 'Bảng lương đã thu hồi',
      body    = 'Bảng lương tháng ' || NEW.month || '/' || NEW.year ||
                ' đang được chỉnh sửa lại. Bạn sẽ nhận thông báo mới khi phiếu lương sẵn sàng.',
      link    = NULL,
      is_read = true
  WHERE type = 'payslip_pending_review'
    AND metadata->>'sheet_id' = NEW.id::text;

  -- ponytail: mỗi row update fire trg_payroll_records_touch_expense (recompute cả sheet).
  -- Điều kiện IN (...) giữ số row chạm ở mức tối thiểu; sheet ~20 người nên chấp nhận được.
  UPDATE public.pay_payroll_records
  SET employee_status       = 'pending',
      employee_confirmed_at = NULL
  WHERE sheet_id = NEW.id
    AND employee_status IN ('confirmed', 'resolved');

  RETURN NEW;
END;
$function$;

-- Dọn hiện trạng: sheet đang draft mà record vẫn mang xác nhận cũ.
UPDATE public.pay_payroll_records pr
SET employee_status       = 'pending',
    employee_confirmed_at = NULL
FROM public.pay_payroll_sheets s
WHERE s.id = pr.sheet_id
  AND s.status = 'draft'
  AND pr.employee_status IN ('confirmed', 'resolved');
