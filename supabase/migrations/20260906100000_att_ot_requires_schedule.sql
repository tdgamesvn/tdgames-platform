-- Bấm giờ OT chỉ khi Admin đã tạo lịch OT (att_holidays.kind = 'ot') phủ ngày đó.
-- Hôm 05/09 là ngày làm bù (kind='makeup') mà nhân viên vẫn check-in/out OT được vì
-- 20260827100000 chỉ whitelist cột, không kiểm lịch. Ngày làm bù tính như ngày thường,
-- không có OT.
--
-- Nguồn sự thật duy nhất: att_day_kind() — sync công cũng chỉ tính ot_hours_weekend cho
-- ngày kind='ot', nên gate cùng hàm là khớp "không có lịch ⇒ không bấm được ⇒ không tính".
--
-- ponytail: RAISE thay vì ép NULL như guard_self_update_columns — client phải thấy lý do.
-- Staff/service_role không bị chặn (HR sửa tay đi lối att_records_staff như cũ).
CREATE OR REPLACE FUNCTION public.att_records_guard_ot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN RETURN NEW; END IF;
  IF is_staff() THEN RETURN NEW; END IF;

  IF (NEW.ot_check_in  IS DISTINCT FROM OLD.ot_check_in
      OR NEW.ot_check_out IS DISTINCT FROM OLD.ot_check_out)
     AND public.att_day_kind(NEW.date) <> 'ot' THEN
    RAISE EXCEPTION 'Hôm nay không có lịch OT — Admin chưa tạo lịch tăng ca cho ngày %', NEW.date
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS att_records_guard_ot ON public.att_records;
CREATE TRIGGER att_records_guard_ot
  BEFORE UPDATE OF ot_check_in, ot_check_out ON public.att_records
  FOR EACH ROW EXECUTE FUNCTION public.att_records_guard_ot();
