-- Muộn/sớm: (1) ngày làm bù (att_day_kind='makeup', thứ 7) trước bị zero vì check applicable_days;
-- (2) về sớm KHÔNG có ngưỡng (17:20 = sớm 10p); (3) đơn nghỉ đã duyệt có giờ (time_from/time_to)
-- dời mốc vào/ra: nghỉ sáng tới 12:00 → mốc vào 13:00 (qua trưa); xin về 16:30 → mốc ra 16:30.
-- Duyệt/sửa đơn → chạm lại att_records để trigger tính lại.

CREATE OR REPLACE FUNCTION public.att_compute_late_early()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sh    public.att_shifts;
  _from  text;
  _start time;
  _end   time;
  _t     time;
  _diff  int;
BEGIN
  _sh := att_resolve_shift(NEW.employee_id, NEW.date, NEW.shift_id);
  IF _sh.id IS NULL THEN RETURN NEW; END IF;
  NEW.shift_id := COALESCE(NEW.shift_id, _sh.id);

  SELECT value INTO _from FROM app_config WHERE key = 'att_sync_from_month';

  IF (_from IS NOT NULL AND to_char(NEW.date, 'YYYY-MM') < _from)
     OR att_day_kind(NEW.date) NOT IN ('work', 'makeup')
     OR EXISTS (SELECT 1 FROM att_requests q            -- nghỉ cả ngày đã duyệt
                WHERE q.employee_id = NEW.employee_id AND q.request_type = 'leave'
                  AND q.status = 'approved' AND q.time_from IS NULL
                  AND NEW.date BETWEEN q.date_from AND q.date_to)
  THEN
    NEW.late_minutes  := 0;
    NEW.early_minutes := 0;
    IF COALESCE(NEW.status, 'present') = 'late' THEN NEW.status := 'present'; END IF;
    RETURN NEW;
  END IF;

  _start := _sh.start_time;
  _end   := _sh.end_time;

  -- Nghỉ có giờ đã duyệt phủ đầu ca → dời mốc vào; phủ cuối ca → dời mốc ra
  SELECT max(q.time_to) INTO _t FROM att_requests q
  WHERE q.employee_id = NEW.employee_id AND q.request_type = 'leave' AND q.status = 'approved'
    AND NEW.date BETWEEN q.date_from AND q.date_to
    AND q.time_from <= _start AND q.time_to > _start;
  IF _t IS NOT NULL THEN _start := _t; END IF;

  SELECT min(q.time_from) INTO _t FROM att_requests q
  WHERE q.employee_id = NEW.employee_id AND q.request_type = 'leave' AND q.status = 'approved'
    AND NEW.date BETWEEN q.date_from AND q.date_to
    AND q.time_to >= _end AND q.time_from < _end;
  IF _t IS NOT NULL THEN _end := _t; END IF;

  -- ponytail: nghỉ trưa cố định 12:00–13:00 (ca có break 60p); thêm cột break_start vào att_shifts nếu ca khác giờ trưa
  IF COALESCE(_sh.break_minutes, 0) > 0 AND _start >= '12:00' AND _start < '13:00' THEN _start := '13:00'; END IF;
  IF COALESCE(_sh.break_minutes, 0) > 0 AND _end   >  '12:00' AND _end   <= '13:00' THEN _end   := '12:00'; END IF;

  IF NEW.check_in IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      (NEW.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time - _start)) / 60, 0)::int;
    NEW.late_minutes := CASE WHEN _diff > COALESCE(_sh.late_threshold_minutes, 0) THEN _diff ELSE 0 END;
  END IF;

  IF NEW.check_out IS NOT NULL THEN
    NEW.early_minutes := GREATEST(EXTRACT(EPOCH FROM (
      _end - (NEW.check_out AT TIME ZONE 'Asia/Ho_Chi_Minh')::time)) / 60, 0)::int;
  END IF;

  IF COALESCE(NEW.status, 'present') IN ('present', 'late') THEN
    NEW.status := CASE WHEN COALESCE(NEW.late_minutes, 0) > 0 THEN 'late' ELSE 'present' END;
  END IF;

  RETURN NEW;
END;
$$;

-- Đơn nghỉ thay đổi → tính lại muộn/sớm các ngày liên quan
CREATE OR REPLACE FUNCTION public.att_requests_touch_records()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _r record;
BEGIN
  FOR _r IN SELECT * FROM (VALUES (OLD), (NEW)) v(q)
            WHERE (v.q).id IS NOT NULL AND (v.q).request_type = 'leave' LOOP
    UPDATE att_records SET shift_id = shift_id
     WHERE employee_id = (_r.q).employee_id AND date BETWEEN (_r.q).date_from AND (_r.q).date_to;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS att_requests_touch_records ON public.att_requests;
CREATE TRIGGER att_requests_touch_records
AFTER INSERT OR UPDATE OR DELETE ON public.att_requests
FOR EACH ROW EXECUTE FUNCTION public.att_requests_touch_records();

-- Backfill từ tháng bắt đầu chấm app
UPDATE public.att_records SET shift_id = shift_id
 WHERE to_char(date, 'YYYY-MM') >= COALESCE((SELECT value FROM public.app_config WHERE key = 'att_sync_from_month'), '2026-09');
