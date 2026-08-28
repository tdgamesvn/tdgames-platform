-- Tháng chấm thử nghiệm thì không tính đi muộn / về sớm.
--
-- T8/2026 sếp mới cho nhân viên bấm thử app, T9 mới chấm chuẩn. Số muộn sinh ra từ tháng
-- thử nghiệm là rác: báo cáo T8 đang có 6 người "muộn 87 phút" cùng ngày 26/08 (hôm đó nghỉ),
-- và Portal thì đập vào mặt nhân viên dòng "⏰ Muộn 1 ngày" cho tháng chưa tính gì cả.
--
-- Dùng lại đúng mốc `app_config.att_sync_from_month` = '2026-09' mà `att_sync_month_workdays`
-- đã dùng — KHÔNG đẻ thêm cờ cấu hình thứ hai. Trượt lịch triển khai thì UPDATE một dòng
-- config là cả ngày công lẫn muộn/sớm cùng dịch theo, không có chuyện hai mốc lệch nhau.
--
-- Bản ghi cũ không cần xoá tay: trigger tự trả 0 khi backfill.
CREATE OR REPLACE FUNCTION public.att_compute_late_early()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sh    record;
  _dow   text;
  _from  text;
  _diff  int;
BEGIN
  SELECT s.* INTO _sh
  FROM att_shifts s
  WHERE s.id = NEW.shift_id
     OR (NEW.shift_id IS NULL AND s.is_active AND s.shift_type = 'fixed')
  ORDER BY (s.id = NEW.shift_id) DESC NULLS LAST, s.created_at
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT value INTO _from FROM app_config WHERE key = 'att_sync_from_month';
  _dow := to_char(NEW.date, 'dy');

  -- Không tính muộn/sớm khi: tháng còn thử nghiệm, ngoài ngày làm việc của ca, hoặc nghỉ lễ.
  IF (_from IS NOT NULL AND to_char(NEW.date, 'YYYY-MM') < _from)
     OR NOT (_dow = ANY(_sh.applicable_days))
     OR EXISTS (
       SELECT 1 FROM att_holidays h
       WHERE NEW.date BETWEEN h.date_from AND h.date_to
     )
  THEN
    NEW.late_minutes  := 0;
    NEW.early_minutes := 0;
    IF COALESCE(NEW.status, 'present') = 'late' THEN NEW.status := 'present'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.check_in IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      (NEW.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time - _sh.start_time
    )) / 60, 0)::int;
    NEW.late_minutes := CASE
      WHEN _diff > COALESCE(_sh.late_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  IF NEW.check_out IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      _sh.end_time - (NEW.check_out AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
    )) / 60, 0)::int;
    NEW.early_minutes := CASE
      WHEN _diff > COALESCE(_sh.early_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  IF COALESCE(NEW.status, 'present') IN ('present', 'late') THEN
    NEW.status := CASE WHEN COALESCE(NEW.late_minutes, 0) > 0 THEN 'late' ELSE 'present' END;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.att_records SET status = status;
