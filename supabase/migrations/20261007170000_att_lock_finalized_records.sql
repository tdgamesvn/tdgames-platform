-- Khoá dòng công của bảng chấm công ĐÃ CHỐT ở tầng DB.
-- Trước: "chốt" chỉ là disabled ở UI; policy att_monthly_records_staff (ALL) cho HR/kế toán
-- sửa thẳng work_days/OT sau khi chốt ⇒ lệch với bảng lương đã tạo từ bảng công đó.
-- Sau: bảng finalized ⇒ cấm INSERT/DELETE dòng và cấm đổi cột số liệu. Vẫn cho đổi
-- note / confirmed_at. Muốn sửa số: mở lại bảng (status ≠ finalized) → sửa → chốt lại.
-- Áp cho mọi role kể cả SECURITY DEFINER: mọi hàm sync (att_sync_*) đã tự bỏ qua bảng chốt.
-- Xoá cả bảng công (cascade): dòng sheet đã biến mất ⇒ NOT FOUND ⇒ cho qua.

CREATE OR REPLACE FUNCTION public.att_guard_finalized_records()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE _st text; _r public.att_monthly_records;
BEGIN
  _r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT status INTO _st FROM public.att_monthly_sheets WHERE id = _r.sheet_id;
  IF NOT FOUND OR _st IS DISTINCT FROM 'finalized' THEN
    -- UPDATE chuyển dòng sang sheet khác: kiểm cả sheet cũ
    IF TG_OP = 'UPDATE' AND OLD.sheet_id IS DISTINCT FROM NEW.sheet_id
       AND EXISTS (SELECT 1 FROM public.att_monthly_sheets WHERE id = OLD.sheet_id AND status = 'finalized') THEN
      RAISE EXCEPTION 'Bảng công đã chốt — mở lại bảng trước khi sửa';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP IN ('INSERT','DELETE') THEN
    RAISE EXCEPTION 'Bảng công đã chốt — mở lại bảng trước khi thêm/xoá nhân viên';
  END IF;

  IF NEW.employee_id            IS DISTINCT FROM OLD.employee_id
  OR NEW.work_days              IS DISTINCT FROM OLD.work_days
  OR NEW.work_days_manual       IS DISTINCT FROM OLD.work_days_manual
  OR NEW.ot_hours               IS DISTINCT FROM OLD.ot_hours
  OR NEW.ot_hours_weekend       IS DISTINCT FROM OLD.ot_hours_weekend
  OR NEW.ot_hours_holiday       IS DISTINCT FROM OLD.ot_hours_holiday
  OR NEW.ot_hours_night         IS DISTINCT FROM OLD.ot_hours_night
  OR NEW.ot_hours_night_weekend IS DISTINCT FROM OLD.ot_hours_night_weekend
  OR NEW.ot_hours_night_holiday IS DISTINCT FROM OLD.ot_hours_night_holiday
  OR NEW.late_count             IS DISTINCT FROM OLD.late_count
  OR NEW.early_count            IS DISTINCT FROM OLD.early_count
  OR NEW.absent_days            IS DISTINCT FROM OLD.absent_days THEN
    RAISE EXCEPTION 'Bảng công đã chốt — mở lại bảng trước khi sửa ngày công / OT';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS att_monthly_records_guard_finalized ON public.att_monthly_records;
CREATE TRIGGER att_monthly_records_guard_finalized
  BEFORE INSERT OR UPDATE OR DELETE ON public.att_monthly_records
  FOR EACH ROW EXECUTE FUNCTION public.att_guard_finalized_records();
