-- Chốt bảng công chỉ khi đã gửi NV xác nhận VÀ mọi NV bắt buộc đã xác nhận (sếp chốt 02/10/2026,
-- giống bảng lương). Trước đây UI chỉ cảnh báo, HR bấm "Vẫn chốt" là qua — T9/2026 chốt khi chưa gửi.
-- NV bắt buộc = nhận được thông báo và tự bấm được trong Portal: đang làm, có tài khoản, không bị
-- loại khỏi lương. Ai không có tài khoản Portal thì không thể xác nhận ⇒ không tính, kẻo kẹt bảng.
-- Chỉ chặn chuyển draft → finalized; mở lại (→ draft) và các update khác không đụng.

CREATE OR REPLACE FUNCTION public.att_guard_sheet_finalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pending int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalized' OR OLD.status = 'finalized' THEN
    RETURN NEW;
  END IF;

  IF NEW.review_sent_at IS NULL THEN
    RAISE EXCEPTION 'Chua gui NV xac nhan bang cong — bam "Gui NV xac nhan" truoc khi chot.';
  END IF;

  SELECT count(*) INTO _pending
  FROM att_monthly_records mr
  JOIN hr_employees e ON e.id = mr.employee_id
  WHERE mr.sheet_id = NEW.id
    AND mr.confirmed_at IS NULL
    AND e.status = 'active'
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false);

  IF _pending > 0 THEN
    RAISE EXCEPTION 'Con % nhan vien chua xac nhan bang cong — chua chot duoc.', _pending;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.att_guard_sheet_finalize() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS att_monthly_sheets_guard_finalize ON public.att_monthly_sheets;
CREATE TRIGGER att_monthly_sheets_guard_finalize
  BEFORE UPDATE OF status ON public.att_monthly_sheets
  FOR EACH ROW EXECUTE FUNCTION public.att_guard_sheet_finalize();
