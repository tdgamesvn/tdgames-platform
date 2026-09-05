-- Bảng công tự sync 23:30 (giờ VN) mỗi đêm cho tháng hiện tại còn draft; sang tháng sau cron không đụng
-- bảng cũ nữa → HR bấm sync lần cuối, sửa tay, chốt. Sync đếm thêm ngày đi muộn / về sớm
-- (late_minutes/early_minutes do trigger att_compute_late_early tính). Chưa có chính sách phạt —
-- chỉ theo dõi, payroll không đọc early_count.

ALTER TABLE public.att_monthly_records ADD COLUMN IF NOT EXISTS early_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.att_sync_month_workdays(_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sheet       record;
  _updated     int;
  _ot_updated  int;
  _missing     int;
  _holiday     numeric;
  _from_month  text;
  _sheet_month text;
  _m0          date;
  _m1          date;
BEGIN
  -- cron chạy dưới postgres, không có JWT
  IF NOT (is_staff() OR current_user IN ('postgres', 'supabase_admin')) THEN
    RAISE EXCEPTION 'Chi HR/admin duoc tinh bang cong tu du lieu cham cong';
  END IF;

  SELECT * INTO _sheet FROM att_monthly_sheets WHERE id = _sheet_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay bang cong';
  END IF;
  IF _sheet.status = 'finalized' THEN
    RAISE EXCEPTION 'Bang cong da chot - mo lai truoc khi tinh lai';
  END IF;

  SELECT value INTO _from_month FROM app_config WHERE key = 'att_sync_from_month';
  _from_month  := COALESCE(NULLIF(_from_month, ''), '2026-09');
  _sheet_month := _sheet.year::text || '-' || lpad(_sheet.month::text, 2, '0');
  IF _sheet_month < _from_month THEN
    RAISE EXCEPTION 'Thang % nhap tay tu may cham cong. Tinh tu app chi ap dung tu thang % tro di.',
      _sheet_month, _from_month;
  END IF;

  _m0 := make_date(_sheet.year, _sheet.month, 1);
  _m1 := (_m0 + interval '1 month')::date;

  DROP TABLE IF EXISTS _days;
  CREATE TEMP TABLE _days ON COMMIT DROP AS
  SELECT d::date AS d, att_day_kind(d::date) AS kind
  FROM   generate_series(_m0, _m1 - 1, interval '1 day') d;

  WITH rec AS (
    SELECT r.employee_id, dy.kind,
           att_work_hours(r.check_in, r.check_out, COALESCE(s.break_minutes, 60)) AS hrs
    FROM   att_records r
    JOIN   _days dy ON dy.d = r.date
    LEFT   JOIN att_shifts s ON s.id = r.shift_id
    WHERE  r.check_in IS NOT NULL AND r.check_out IS NOT NULL
  ), hours AS (
    SELECT employee_id, SUM(hrs) / 8.0 AS wd FROM rec WHERE kind IN ('work', 'makeup') GROUP BY 1
  ), hol AS (
    SELECT mr.employee_id, count(*)::numeric AS wd
    FROM   att_monthly_records mr
    JOIN   hr_employees e ON e.id = mr.employee_id
    JOIN   _days dy ON dy.kind = 'holiday' AND extract(isodow FROM dy.d) < 6
    WHERE  mr.sheet_id = _sheet_id
      AND  COALESCE(e.official_date, e.probation_end + 1) <= dy.d
      AND  (e.start_date IS NULL OR e.start_date <= dy.d)
    GROUP  BY 1
  ), lv AS (
    SELECT q.employee_id,
           SUM(COALESCE(q.leave_days, 1)
               * (SELECT count(*) FROM _days dy
                   WHERE dy.d BETWEEN q.date_from AND q.date_to AND dy.kind IN ('work', 'makeup'))
               / GREATEST(1, (SELECT count(*) FROM generate_series(q.date_from, q.date_to, interval '1 day') g
                               WHERE att_day_kind(g::date) IN ('work', 'makeup')))) AS wd
    FROM   att_requests q
    WHERE  q.request_type = 'leave' AND q.status = 'approved'
      AND  q.leave_type IN ('annual', 'birthday')
      AND  q.date_from < _m1 AND q.date_to >= _m0
    GROUP  BY 1
  ), base AS (
    SELECT employee_id FROM hours UNION SELECT employee_id FROM lv
  ), agg AS (
    SELECT b.employee_id, COALESCE(h.wd, 0) + COALESCE(l.wd, 0) + COALESCE(v.wd, 0) AS wd
    FROM   base b
    LEFT   JOIN hours h USING (employee_id)
    LEFT   JOIN hol   l USING (employee_id)
    LEFT   JOIN lv    v USING (employee_id)
  )
  UPDATE att_monthly_records mr
     SET work_days = ROUND(agg.wd, 2)
    FROM agg
   WHERE mr.sheet_id = _sheet_id AND mr.employee_id = agg.employee_id;
  GET DIAGNOSTICS _updated = ROW_COUNT;

  UPDATE att_monthly_records mr
     SET ot_hours_weekend = ROUND(x.h, 2)
    FROM (SELECT r.employee_id, SUM(att_work_hours(r.check_in, r.check_out, COALESCE(s.break_minutes, 60))) AS h
            FROM att_records r
            JOIN _days dy ON dy.d = r.date AND dy.kind = 'ot'
            LEFT JOIN att_shifts s ON s.id = r.shift_id
           WHERE r.check_in IS NOT NULL AND r.check_out IS NOT NULL
           GROUP BY 1) x
   WHERE mr.sheet_id = _sheet_id AND mr.employee_id = x.employee_id;
  GET DIAGNOSTICS _ot_updated = ROW_COUNT;

  -- Đi muộn / về sớm: đếm ngày, chỉ theo dõi
  UPDATE att_monthly_records mr
     SET late_count = x.late, early_count = x.early
    FROM (SELECT r.employee_id,
                 count(*) FILTER (WHERE COALESCE(r.late_minutes, 0)  > 0)::int AS late,
                 count(*) FILTER (WHERE COALESCE(r.early_minutes, 0) > 0)::int AS early
            FROM att_records r JOIN _days dy ON dy.d = r.date
           GROUP BY 1) x
   WHERE mr.sheet_id = _sheet_id AND mr.employee_id = x.employee_id;

  SELECT count(*) INTO _holiday FROM _days WHERE kind = 'holiday' AND extract(isodow FROM d) < 6;

  SELECT count(*) INTO _missing
  FROM   att_records r
  JOIN   att_monthly_records mr ON mr.employee_id = r.employee_id AND mr.sheet_id = _sheet_id
  WHERE  r.date >= _m0 AND r.date < _m1
    AND  (r.check_in IS NULL OR r.check_out IS NULL);

  RETURN jsonb_build_object('updated', _updated, 'missing_checkout', _missing,
                            'holiday_days', _holiday, 'ot_weekend_updated', _ot_updated);
END;
$$;

-- Sync mọi bảng draft của tháng hiện tại (mỗi sổ công ty 1 bảng).
CREATE OR REPLACE FUNCTION public.att_sync_current_month()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _d  date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _s  record;
BEGIN
  FOR _s IN
    SELECT id FROM att_monthly_sheets
    WHERE year = extract(year FROM _d) AND month = extract(month FROM _d) AND status = 'draft'
  LOOP
    PERFORM att_sync_month_workdays(_s.id);
  END LOOP;
END;
$$;

SELECT cron.unschedule('attendance-sync-nightly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-sync-nightly');
SELECT cron.schedule('attendance-sync-nightly', '30 16 * * *', 'SELECT public.att_sync_current_month()');
