-- Chuẩn hoá chấm công từ T9/2026 (sếp chốt 05/09):
-- 1) att_holidays.kind: holiday (nghỉ lễ) | makeup (làm bù: tính như ngày thường + nhắc chấm công)
--    | ot (lịch OT: giờ làm → ot_hours_weekend). T7/CN không có lịch gì ⇒ không tính công.
-- 2) att_work_days: theo giờ thực làm trong khung 08:00–20:00 (giờ VN), trừ nghỉ trưa 12:00 +
--    break_minutes của ca, tối đa 8h = 1 công. Không có ngưỡng miễn trễ/sớm.
-- 3) Sync cộng phép năm / sinh nhật đã duyệt (annual, birthday). Remote & không lương = 0
--    (remote vẫn phải check-in/out như thường, chỉ bỏ GPS).
-- 4) Nhắc chấm công chạy cả 7 ngày; hàm tự gate theo kind của ngày (nhắc cả ngày làm bù).

ALTER TABLE public.att_holidays ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'holiday';
ALTER TABLE public.att_holidays DROP CONSTRAINT IF EXISTS att_holidays_kind_chk;
ALTER TABLE public.att_holidays ADD CONSTRAINT att_holidays_kind_chk CHECK (kind IN ('holiday', 'makeup', 'ot'));

-- Loại ngày: holiday > makeup > ot > work (T2–T6) > off (T7/CN)
CREATE OR REPLACE FUNCTION public.att_day_kind(_d date)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT h.kind FROM att_holidays h
      WHERE _d BETWEEN h.date_from AND h.date_to
      ORDER BY CASE h.kind WHEN 'holiday' THEN 0 WHEN 'makeup' THEN 1 ELSE 2 END
      LIMIT 1),
    CASE WHEN extract(isodow FROM _d) < 6 THEN 'work' ELSE 'off' END);
$$;

-- Giờ làm tính tiền: giao của [in,out] với [08:00,20:00] trừ giao với [12:00, 12:00+break], cap 8h.
CREATE OR REPLACE FUNCTION public.att_work_hours(_in timestamptz, _out timestamptz, _break_minutes int DEFAULT 60)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN _in IS NULL OR _out IS NULL OR _out <= _in THEN 0 ELSE
    LEAST(8, GREATEST(0,
      EXTRACT(EPOCH FROM (LEAST(o, d + time '20:00') - GREATEST(i, d + time '08:00'))) / 3600.0
      - GREATEST(0, EXTRACT(EPOCH FROM (
          LEAST(o, d + time '12:00' + make_interval(mins => COALESCE(_break_minutes, 60)))
          - GREATEST(i, d + time '12:00'))) / 3600.0)
    )) END
  FROM (SELECT (_in  AT TIME ZONE 'Asia/Ho_Chi_Minh')       AS i,
               (_out AT TIME ZONE 'Asia/Ho_Chi_Minh')       AS o,
               (_in  AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d) t;
$$;

CREATE OR REPLACE FUNCTION public.att_work_days(_in timestamptz, _out timestamptz, _break_minutes int DEFAULT 60)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT ROUND(public.att_work_hours(_in, _out, _break_minutes) / 8.0, 2);
$$;

-- Nhắc chấm công: ngày work/makeup, không có đơn nghỉ (trừ remote) pending/approved, không exclude_from_payroll.
CREATE OR REPLACE FUNCTION public.att_should_check_today(_employee_id uuid, _date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.att_day_kind(_date) IN ('work', 'makeup')
  AND NOT EXISTS (
    SELECT 1 FROM public.att_requests q
    WHERE q.employee_id = _employee_id
      AND q.request_type = 'leave'
      AND q.status IN ('approved', 'pending')
      AND COALESCE(q.leave_type, '') <> 'remote'
      AND _date BETWEEN q.date_from AND q.date_to
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = _employee_id AND e.exclude_from_payroll
  );
$$;

SELECT cron.unschedule('attendance-remind-checkin')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkin');
SELECT cron.unschedule('attendance-remind-checkout') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkout');
SELECT cron.schedule('attendance-remind-checkin',  '*/15 0-16 * * *', 'SELECT public.notify_missing_checkin()');
SELECT cron.schedule('attendance-remind-checkout', '*/15 0-16 * * *', 'SELECT public.notify_missing_checkout()');

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
  IF NOT is_staff() THEN
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

  -- ponytail: ghi đè work_days (+ ot_hours_weekend cho ngày kind='ot'). late_count/absent_days/OT khác HR nhập tay.
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
    -- Phép năm / sinh nhật đã duyệt: chia leave_days đều lên các ngày làm việc của đơn, lấy phần rơi vào tháng.
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
