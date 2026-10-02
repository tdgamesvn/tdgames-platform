-- Ngày công: làm tròn 1 chữ số thập phân (22.48 → 22.5, 22.44 → 22.4) + khoá ô HR sửa tay.
--
-- Trước đây cron `attendance-sync-nightly` (att_sync_current_month) chạy att_sync_month_workdays
-- cho tháng hiện tại VÀ tháng trước chưa chốt ⇒ mỗi đêm ghi đè work_days HR đã sửa tay
-- (VD Châu T9 sửa 10 → 9.6 theo máy chấm công, đêm về lại 10).
-- Nay: HR sửa tay ⇒ work_days_manual = true ⇒ sync bỏ qua ô đó. Nút "Tính lại" trên UI
-- (đã có confirm "ghi đè kể cả số sửa tay") tự xoá cờ trước khi gọi sync.

ALTER TABLE public.att_monthly_records
  ADD COLUMN IF NOT EXISTS work_days_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.att_monthly_records.work_days_manual IS
  'HR sửa tay work_days ⇒ true; att_sync_month_workdays không ghi đè. UI "Tính lại" reset về false.';

CREATE OR REPLACE FUNCTION public.att_work_days(_in timestamp with time zone, _out timestamp with time zone, _break_minutes integer DEFAULT 60)
RETURNS numeric
LANGUAGE sql
STABLE
AS $function$
  SELECT ROUND(public.att_work_hours(_in, _out, _break_minutes) / 8.0, 1);
$function$;

CREATE OR REPLACE FUNCTION public.att_sync_month_workdays(_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  ), evt AS (
    SELECT r.employee_id, count(DISTINCT r.date)::numeric AS wd
    FROM   att_records r
    JOIN   _days dy ON dy.d = r.date AND dy.kind = 'event'
    WHERE  r.check_in IS NOT NULL
    GROUP  BY 1
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
                   WHERE dy.d BETWEEN q.date_from AND q.date_to AND dy.kind IN ('work', 'makeup', 'event'))
               / GREATEST(1, (SELECT count(*) FROM generate_series(q.date_from, q.date_to, interval '1 day') g
                               WHERE att_day_kind(g::date) IN ('work', 'makeup', 'event')))) AS wd
    FROM   att_requests q
    WHERE  q.request_type = 'leave' AND q.status = 'approved'
      AND  q.leave_type IN ('annual', 'birthday')
      AND  q.date_from < _m1 AND q.date_to >= _m0
    GROUP  BY 1
  ), base AS (
    SELECT employee_id FROM hours UNION SELECT employee_id FROM lv UNION SELECT employee_id FROM evt
  ), agg AS (
    SELECT b.employee_id,
           COALESCE(h.wd, 0) + COALESCE(l.wd, 0) + COALESCE(v.wd, 0) + COALESCE(ev.wd, 0) AS wd
    FROM   base b
    LEFT   JOIN hours h  USING (employee_id)
    LEFT   JOIN hol   l  USING (employee_id)
    LEFT   JOIN lv    v  USING (employee_id)
    LEFT   JOIN evt   ev USING (employee_id)
  )
  UPDATE att_monthly_records mr
     SET work_days = ROUND(agg.wd, 1)
    FROM agg
   WHERE mr.sheet_id = _sheet_id AND mr.employee_id = agg.employee_id
     AND NOT mr.work_days_manual;
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
  JOIN   _days dy ON dy.d = r.date AND dy.kind <> 'event'
  WHERE  (r.check_in IS NULL OR r.check_out IS NULL);

  RETURN jsonb_build_object('updated', _updated, 'missing_checkout', _missing,
                            'holiday_days', _holiday, 'ot_weekend_updated', _ot_updated);
END;
$function$;

-- Dữ liệu: khoá ô đã sửa tay theo máy chấm công (Châu T9 = 9.6) + làm tròn 1 số các bảng chưa chốt.
UPDATE public.att_monthly_records
   SET work_days_manual = true
 WHERE note LIKE '%Sửa theo máy chấm công%';

UPDATE public.att_monthly_records mr
   SET work_days = ROUND(mr.work_days, 1)
  FROM public.att_monthly_sheets sh
 WHERE sh.id = mr.sheet_id AND sh.status <> 'finalized'
   AND mr.work_days <> ROUND(mr.work_days, 1);
