-- Phân ca theo nhân viên có hiệu lực thật.
-- Trước: att_employee_shifts không ai đọc — trigger muộn/sớm và cron nhắc đều so với ca fixed
-- đầu tiên (08:30–17:30) cho tất cả. Part-time ra 12:00 ⇒ "về sớm" 300p/ngày + nhắc check-out tới tối.
-- Sau: 1 helper resolve ca theo thứ tự record.shift_id → phân ca còn hiệu lực → ca fixed mặc định.
-- Trigger ghi luôn shift_id vào record khi NULL ⇒ att_sync_month_workdays lấy đúng break_minutes.

CREATE OR REPLACE FUNCTION public.att_resolve_shift(_employee_id uuid, _date date, _shift_id uuid DEFAULT NULL)
RETURNS public.att_shifts
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.*
  FROM   att_shifts s
  LEFT   JOIN att_employee_shifts es
         ON  es.shift_id = s.id AND es.employee_id = _employee_id
         AND COALESCE(es.effective_from, '1900-01-01') <= _date
         AND (es.effective_to IS NULL OR es.effective_to >= _date)
  WHERE  s.id = _shift_id
     OR  es.id IS NOT NULL
     OR  (s.is_active AND s.shift_type = 'fixed')
  ORDER  BY (s.id = _shift_id) DESC NULLS LAST,
            (es.id IS NOT NULL) DESC,
            es.effective_from DESC NULLS LAST,
            s.created_at
  LIMIT  1;
$$;

CREATE OR REPLACE FUNCTION public.att_compute_late_early()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sh    public.att_shifts;
  _dow   text;
  _from  text;
  _diff  int;
BEGIN
  _sh := att_resolve_shift(NEW.employee_id, NEW.date, NEW.shift_id);
  IF _sh.id IS NULL THEN RETURN NEW; END IF;
  NEW.shift_id := COALESCE(NEW.shift_id, _sh.id);

  SELECT value INTO _from FROM app_config WHERE key = 'att_sync_from_month';
  _dow := to_char(NEW.date, 'dy');

  IF (_from IS NOT NULL AND to_char(NEW.date, 'YYYY-MM') < _from)
     OR NOT (_dow = ANY(_sh.applicable_days))
     OR EXISTS (SELECT 1 FROM att_holidays h WHERE NEW.date BETWEEN h.date_from AND h.date_to)
  THEN
    NEW.late_minutes  := 0;
    NEW.early_minutes := 0;
    IF COALESCE(NEW.status, 'present') = 'late' THEN NEW.status := 'present'; END IF;
    RETURN NEW;
  END IF;

  IF NEW.check_in IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      (NEW.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time - _sh.start_time)) / 60, 0)::int;
    NEW.late_minutes := CASE WHEN _diff > COALESCE(_sh.late_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  IF NEW.check_out IS NOT NULL THEN
    _diff := GREATEST(EXTRACT(EPOCH FROM (
      _sh.end_time - (NEW.check_out AT TIME ZONE 'Asia/Ho_Chi_Minh')::time)) / 60, 0)::int;
    NEW.early_minutes := CASE WHEN _diff > COALESCE(_sh.early_threshold_minutes, 15) THEN _diff ELSE 0 END;
  END IF;

  IF COALESCE(NEW.status, 'present') IN ('present', 'late') THEN
    NEW.status := CASE WHEN COALESCE(NEW.late_minutes, 0) > 0 THEN 'late' ELSE 'present' END;
  END IF;

  RETURN NEW;
END;
$$;

-- Nhắc check-in: cửa sổ [start, start+2h) theo ca của từng NV; Discord ở [start+30, start+45).
CREATE OR REPLACE FUNCTION public.notify_missing_checkin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now      time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _url      text;
  _mentions text;
BEGIN
  DELETE FROM public.notifications n
  WHERE n.type = 'attendance_reminder'
    AND n.title LIKE '%check-in%'
    AND n.is_read = false
    AND n.created_at < now() - interval '14 minutes'
    AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id,
         'attendance_reminder',
         '⏰ Bạn chưa check-in hôm nay',
         'Mở app trên điện thoại để chấm công. Quên chấm thì phải làm đơn giải trình.',
         '#portal/tasks'
  FROM public.hr_employees e
  CROSS JOIN LATERAL public.att_resolve_shift(e.id, _today) s
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND _now >= COALESCE(s.start_time, '08:30')
    AND _now <  COALESCE(s.start_time, '08:30') + interval '2 hours'
    AND public.att_should_check_today(e.id, _today)
    AND NOT EXISTS (
      SELECT 1 FROM public.att_records r
      WHERE r.employee_id = e.id AND r.date = _today AND r.check_in IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-in%'
        AND n.created_at > now() - interval '14 minutes');

  SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
  FROM public.hr_employees e
  CROSS JOIN LATERAL public.att_resolve_shift(e.id, _today) s
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND COALESCE(e.discord_user_id, '') <> ''
    AND _now >= COALESCE(s.start_time, '08:30') + interval '30 minutes'
    AND _now <  COALESCE(s.start_time, '08:30') + interval '45 minutes'
    AND public.att_should_check_today(e.id, _today)
    AND NOT EXISTS (
      SELECT 1 FROM public.att_records r
      WHERE r.employee_id = e.id AND r.date = _today AND r.check_in IS NOT NULL);

  IF _mentions IS NOT NULL THEN
    SELECT value INTO _url FROM public.app_config WHERE key = 'discord_attendance_webhook' LIMIT 1;
    IF COALESCE(_url, '') <> '' THEN
      PERFORM net.http_post(
        url     := _url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object('content',
          '⚠️ ' || _mentions || ' — app đã nhắc 3 lần mà vẫn chưa check-in hôm nay. '
          || 'Bấm giờ vào ngay nhé: https://app.tdgamestudio.com/#portal/tasks'));
    END IF;
  END IF;
END;
$$;

-- Nhắc check-out: cửa sổ [end, end+2h) theo ca của từng NV; Discord ở [end+30, end+45).
CREATE OR REPLACE FUNCTION public.notify_missing_checkout()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _today    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now      time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _url      text;
  _mentions text;
BEGIN
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
$$;

-- Backfill: record từ tháng bắt đầu chấm app chưa có shift_id → chạy lại trigger để gắn ca + tính lại muộn/sớm.
UPDATE public.att_records
   SET shift_id = shift_id
 WHERE shift_id IS NULL
   AND to_char(date, 'YYYY-MM') >= COALESCE((SELECT value FROM public.app_config WHERE key = 'att_sync_from_month'), '2026-09');
