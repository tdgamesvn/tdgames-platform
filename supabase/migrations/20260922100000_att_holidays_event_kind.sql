-- Loại ngày mới trong lịch Admin: kind = 'event' (Sự kiện công ty — đi chơi, teambuilding...).
-- Quy tắc: ai có check-in hôm đó thì tính ĐỦ 1 công; không tính muộn/sớm; không cần check-out;
-- không nhắc check-out (app + Discord). Check-in vẫn được nhắc như ngày thường.
-- Bối cảnh: 18/9/2026 công ty đi chơi, 6 người bấm ra lúc ~14:33 (về sớm 175') và 1 người không bấm ⇒ mất công.

ALTER TABLE public.att_holidays DROP CONSTRAINT IF EXISTS att_holidays_kind_chk;
ALTER TABLE public.att_holidays ADD CONSTRAINT att_holidays_kind_chk
  CHECK (kind = ANY (ARRAY['holiday'::text, 'makeup'::text, 'ot'::text, 'event'::text]));

-- Ưu tiên khi trùng ngày: holiday > makeup > event > ot
CREATE OR REPLACE FUNCTION public.att_day_kind(_d date)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT h.kind FROM att_holidays h
      WHERE _d BETWEEN h.date_from AND h.date_to
      ORDER BY CASE h.kind WHEN 'holiday' THEN 0 WHEN 'makeup' THEN 1 WHEN 'event' THEN 2 ELSE 3 END
      LIMIT 1),
    CASE WHEN extract(isodow FROM _d) < 6 THEN 'work' ELSE 'off' END);
$function$;

-- Sự kiện vẫn nhắc check-in (để có bằng chứng có mặt); trigger att_compute_late_early đã tự về 0
-- vì kind NOT IN ('work','makeup').
CREATE OR REPLACE FUNCTION public.att_should_check_today(_employee_id uuid, _date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.att_day_kind(_date) IN ('work', 'makeup', 'event')
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
$function$;

-- Nhắc check-out: bỏ qua ngày sự kiện (cả app lẫn Discord lượt 3).
CREATE OR REPLACE FUNCTION public.notify_missing_checkout()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now      time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _url      text;
  _mentions text;
BEGIN
  IF public.att_day_kind(_today) = 'event' THEN RETURN; END IF;

  DELETE FROM public.notifications n
  WHERE n.type = 'attendance_reminder'
    AND n.title LIKE '%check-out%'
    AND n.is_read = false
    AND n.created_at < now() - interval '14 minutes'
    AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id,
         'attendance_reminder',
         '🏁 Bạn chưa check-out hôm nay',
         'Đã check-in sáng nay nhưng chưa check-out. Nhớ bấm trước khi rời văn phòng.',
         '#portal/tasks'
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_resolve_shift(e.id, _today, r.shift_id) s
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND _now >= COALESCE(s.end_time, '17:30')
    AND _now <  COALESCE(s.end_time, '17:30') + interval '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-out%'
        AND n.created_at > now() - interval '14 minutes');

  SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_resolve_shift(e.id, _today, r.shift_id) s
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND COALESCE(e.discord_user_id, '') <> ''
    AND _now >= COALESCE(s.end_time, '17:30') + interval '30 minutes'
    AND _now <  COALESCE(s.end_time, '17:30') + interval '45 minutes';

  IF _mentions IS NOT NULL THEN
    SELECT value INTO _url FROM public.app_config WHERE key = 'discord_attendance_webhook' LIMIT 1;
    IF COALESCE(_url, '') <> '' THEN
      PERFORM net.http_post(
        url     := _url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object('content',
          '⚠️ ' || _mentions || ' — app đã nhắc 3 lần mà vẫn chưa check-out hôm nay. '
          || 'Bấm giờ ra ngay nhé: https://app.tdgamestudio.com/#portal/tasks'));
    END IF;
  END IF;
END;
$function$;

-- Bảng công: ngày sự kiện = 1 công/ngày cho ai có check-in (không cần check-out, không tính giờ);
-- đơn phép trên ngày sự kiện vẫn tính như ngày làm; thiếu check-out ngày sự kiện không báo "missing".
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
