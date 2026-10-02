-- Kế toán xác nhận phiếu lương HỘ nhân viên (sếp chốt 02/10/2026, phương án a).
-- Lý do: NV đã nghỉ việc / không có tài khoản Portal không tự xác nhận được ⇒ kẹt nút
-- "Đánh dấu đã trả lương" (T9/2026: Nguyễn Phương Anh, Trần Phương Linh).
-- Chỉ cho phép khi NV đã nghỉ (status <> 'active') HOẶC không có tài khoản Portal.
-- NV đang làm có tài khoản vẫn phải tự xác nhận. Bắt buộc lý do; lưu vết ai/lúc nào/lý do.

ALTER TABLE public.pay_payroll_records
  ADD COLUMN IF NOT EXISTS confirmed_on_behalf_by     uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_on_behalf_name   text,
  ADD COLUMN IF NOT EXISTS confirmed_on_behalf_reason text;

CREATE OR REPLACE FUNCTION public.pay_confirm_on_behalf(_record_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r record;
  _name text;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Chi admin/HR/ke toan duoc xac nhan ho'; END IF;
  IF length(trim(COALESCE(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Phai nhap ly do xac nhan ho (it nhat 5 ky tu)';
  END IF;

  SELECT pr.id, pr.employee_status, s.status AS sheet_status, e.status AS emp_status, e.auth_user_id
    INTO _r
  FROM pay_payroll_records pr
  JOIN pay_payroll_sheets s ON s.id = pr.sheet_id
  JOIN hr_employees e ON e.id = pr.employee_id
  WHERE pr.id = _record_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Khong tim thay dong bang luong'; END IF;
  IF _r.sheet_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Chi xac nhan ho khi bang luong da xac nhan va chua tra';
  END IF;
  IF COALESCE(_r.employee_status, 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'Dong nay khong o trang thai cho xac nhan';
  END IF;
  IF _r.emp_status = 'active' AND _r.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nhan vien dang lam va co tai khoan Portal — phai tu xac nhan';
  END IF;

  SELECT COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'username', u.email)
    INTO _name FROM auth.users u WHERE u.id = auth.uid();

  UPDATE pay_payroll_records SET
    employee_status            = 'confirmed',
    employee_confirmed_at      = now(),
    confirmed_on_behalf_by     = auth.uid(),
    confirmed_on_behalf_name   = _name,
    confirmed_on_behalf_reason = trim(_reason)
  WHERE id = _record_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_confirm_on_behalf(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_confirm_on_behalf(uuid, text) TO authenticated;

-- Rút bảng lương về nháp: xác nhận hộ cũng phải mất như xác nhận thường (số có thể đổi).
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

  UPDATE public.pay_payroll_records
  SET employee_status            = 'pending',
      employee_confirmed_at      = NULL,
      confirmed_on_behalf_by     = NULL,
      confirmed_on_behalf_name   = NULL,
      confirmed_on_behalf_reason = NULL
  WHERE sheet_id = NEW.id
    AND employee_status IN ('confirmed', 'resolved');

  RETURN NEW;
END;
$function$;
