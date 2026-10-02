-- NV đã xác nhận bảng công mà số liệu dòng của họ đổi sau đó (cron đêm tính lại tháng trước khi HR
-- duyệt dồn đơn đầu tháng, hoặc HR sửa tay) ⇒ xác nhận cũ không còn đúng với con số mới.
-- Huỷ xác nhận của RIÊNG dòng đó + báo NV xác nhận lại. Người khác giữ nguyên.
-- Bảng đã chốt thì không áp (cron/UI đều không sửa bảng chốt; nếu có thì là mở lại có chủ đích).

CREATE OR REPLACE FUNCTION public.att_reset_confirm_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s   record;
  _uid uuid;
BEGIN
  IF OLD.confirmed_at IS NULL OR NEW.confirmed_at IS NULL THEN RETURN NEW; END IF;

  IF NEW.work_days              IS NOT DISTINCT FROM OLD.work_days
     AND NEW.ot_hours               IS NOT DISTINCT FROM OLD.ot_hours
     AND NEW.ot_hours_weekend       IS NOT DISTINCT FROM OLD.ot_hours_weekend
     AND NEW.ot_hours_holiday       IS NOT DISTINCT FROM OLD.ot_hours_holiday
     AND NEW.ot_hours_night         IS NOT DISTINCT FROM OLD.ot_hours_night
     AND NEW.ot_hours_night_weekend IS NOT DISTINCT FROM OLD.ot_hours_night_weekend
     AND NEW.ot_hours_night_holiday IS NOT DISTINCT FROM OLD.ot_hours_night_holiday
     AND NEW.late_count             IS NOT DISTINCT FROM OLD.late_count
     AND NEW.early_count            IS NOT DISTINCT FROM OLD.early_count
     AND NEW.absent_days            IS NOT DISTINCT FROM OLD.absent_days
  THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _s FROM att_monthly_sheets WHERE id = NEW.sheet_id;
  IF NOT FOUND OR _s.status = 'finalized' THEN RETURN NEW; END IF;

  NEW.confirmed_at := NULL;

  SELECT auth_user_id INTO _uid FROM hr_employees WHERE id = NEW.employee_id;
  IF _uid IS NOT NULL THEN
    INSERT INTO notifications (recipient_user_id, type, title, body, link)
    VALUES (_uid, 'attendance_confirm',
            '📋 Bảng công Tháng ' || _s.month || '/' || _s.year || ' vừa cập nhật',
            'Số liệu chấm công của bạn đã thay đổi sau khi bạn xác nhận (duyệt đơn / điều chỉnh). Vui lòng kiểm tra và xác nhận lại.',
            '#portal/tasks');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.att_reset_confirm_on_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS att_monthly_records_reset_confirm ON public.att_monthly_records;
CREATE TRIGGER att_monthly_records_reset_confirm
  BEFORE UPDATE ON public.att_monthly_records
  FOR EACH ROW EXECUTE FUNCTION public.att_reset_confirm_on_change();
