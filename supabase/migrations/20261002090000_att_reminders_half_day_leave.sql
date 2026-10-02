-- Nhắc chấm công vào/ra: tính theo KHUNG GIỜ PHẢI CÓ MẶT trong ngày (ca − đơn nghỉ).
--
-- Lỗi trước đây:
--  1. Nghỉ chiều vẫn bị nhắc check-out lúc hết ca (17:30) + tag Discord; trưa lúc cần
--     check-out thì không ai nhắc ⇒ quên ra ⇒ buổi sáng = 0 công.
--  2. Có đơn nghỉ NỬA ngày sáng ⇒ att_should_check_today() = false cả ngày ⇒ không nhắc
--     check-in buổi chiều.
--  3. Part-time bị nhắc check-in mọi ngày T2–T6 dù không có lịch.
--  4. Cron xoá mọi noti nhắc chưa đọc >14 phút ⇒ hết khung nhắc thì noti cuối cũng mất.
--
-- Quy ước giờ trưa 12:00 + break_minutes của ca — khớp att_work_hours().

CREATE OR REPLACE FUNCTION public.att_expected_window(
  _employee_id uuid, _date date, _shift_id uuid DEFAULT NULL)
RETURNS TABLE (start_time time, end_time time, should_check boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _s       att_shifts;
  _type    text;
  _ex      boolean;
  _st      time;
  _en      time;
  _lunch0  constant time := '12:00';
  _lunch1  time;
  _lv      record;
  _dow     text := (ARRAY['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow FROM _date)::int];
BEGIN
  SELECT e.type, COALESCE(e.exclude_from_payroll, false) INTO _type, _ex
  FROM hr_employees e WHERE e.id = _employee_id;

  _s      := att_resolve_shift(_employee_id, _date, _shift_id);
  _st     := COALESCE(_s.start_time, '08:30');
  _en     := COALESCE(_s.end_time, '17:30');
  _lunch1 := _lunch0 + make_interval(mins => COALESCE(_s.break_minutes, 60));

  should_check := NOT COALESCE(_ex, false)
                  AND att_day_kind(_date) IN ('work', 'makeup', 'event');

  -- Part-time: chỉ ngày có trong lịch ca được GÁN (att_employee_shifts) — không gán = không nhắc vào.
  IF should_check AND _type = 'parttime' THEN
    should_check := _s.id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM att_employee_shifts es
        WHERE es.employee_id = _employee_id AND es.shift_id = _s.id
          AND COALESCE(es.effective_from, '1900-01-01') <= _date
          AND (es.effective_to IS NULL OR es.effective_to >= _date))
      AND (_s.applicable_days IS NULL OR _dow = ANY (_s.applicable_days));
  END IF;

  -- Đơn nghỉ (đã duyệt hoặc đang chờ, trừ remote) cắt bớt khung giờ.
  FOR _lv IN
    SELECT q.date_from, q.date_to, q.time_from, q.time_to
    FROM att_requests q
    WHERE q.employee_id = _employee_id
      AND q.request_type = 'leave'
      AND q.status IN ('approved', 'pending')
      AND COALESCE(q.leave_type, '') <> 'remote'
      AND _date BETWEEN q.date_from AND q.date_to
  LOOP
    IF _lv.date_from <> _lv.date_to OR _lv.time_from IS NULL OR _lv.time_to IS NULL
       OR (_lv.time_from <= _st AND _lv.time_to >= _en) THEN
      should_check := false;                        -- nghỉ trọn ngày
    ELSIF _lv.time_from <= _st THEN                 -- nghỉ đầu ca ⇒ đến muộn hơn
      _st := GREATEST(_st, CASE WHEN _lv.time_to >= _lunch0 AND _lv.time_to < _lunch1
                                THEN _lunch1 ELSE _lv.time_to END);
    ELSIF _lv.time_to >= _en THEN                   -- nghỉ cuối ca ⇒ về sớm hơn
      _en := LEAST(_en, CASE WHEN _lv.time_from > _lunch0 AND _lv.time_from <= _lunch1
                             THEN _lunch0 ELSE _lv.time_from END);
    END IF;                                         -- nghỉ giữa ca: giữ nguyên
  END LOOP;

  IF _st >= _en THEN should_check := false; END IF;

  start_time := _st;
  end_time   := _en;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.att_expected_window(uuid, date, uuid) IS
  'Khung giờ phải có mặt trong ngày = ca (att_resolve_shift) trừ đơn nghỉ nửa ngày. Dùng cho nhắc check-in/out.';

-- Chỉ cron (postgres) gọi — không mở RPC cho client (lộ lịch ca/đơn nghỉ theo employee_id).
REVOKE EXECUTE ON FUNCTION public.att_expected_window(uuid, date, uuid) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.notify_missing_checkin()
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
  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id,
         'attendance_reminder',
         '⏰ Bạn chưa check-in hôm nay',
         'Mở app trên điện thoại để chấm công. Quên chấm thì phải làm đơn giải trình.',
         '#portal/tasks'
  FROM public.hr_employees e
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today) w
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND w.should_check
    AND _now >= w.start_time
    AND _now <  w.start_time + interval '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.att_records r
      WHERE r.employee_id = e.id AND r.date = _today AND r.check_in IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-in%'
        AND n.created_at > now() - interval '14 minutes');

  -- Dọn noti hôm nay: bỏ bản trùng cũ (giữ bản mới nhất) và bản của người đã check-in.
  DELETE FROM public.notifications n
  WHERE n.type = 'attendance_reminder'
    AND n.title LIKE '%check-in%'
    AND n.is_read = false
    AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today
    AND (EXISTS (SELECT 1 FROM public.notifications m
                 WHERE m.recipient_user_id = n.recipient_user_id
                   AND m.type = n.type AND m.title = n.title
                   AND m.created_at > n.created_at)
         OR EXISTS (SELECT 1 FROM public.hr_employees e
                    JOIN public.att_records r ON r.employee_id = e.id AND r.date = _today
                    WHERE e.auth_user_id = n.recipient_user_id AND r.check_in IS NOT NULL));

  SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
  FROM public.hr_employees e
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today) w
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND COALESCE(e.discord_user_id, '') <> ''
    AND w.should_check
    AND _now >= w.start_time + interval '30 minutes'
    AND _now <  w.start_time + interval '45 minutes'
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
$function$;


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

  -- Đã check-in thì luôn nhắc ra (kể cả part-time không gán ca), mốc = hết khung giờ
  -- phải có mặt — nghỉ chiều thì là giờ bắt đầu nghỉ, không phải 17:30.
  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id,
         'attendance_reminder',
         '🏁 Bạn chưa check-out hôm nay',
         'Đã check-in nhưng chưa check-out. Nhớ bấm trước khi rời văn phòng.',
         '#portal/tasks'
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today, r.shift_id) w
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND _now >= w.end_time
    AND _now <  w.end_time + interval '2 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-out%'
        AND n.created_at > now() - interval '14 minutes');

  DELETE FROM public.notifications n
  WHERE n.type = 'attendance_reminder'
    AND n.title LIKE '%check-out%'
    AND n.is_read = false
    AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today
    AND (EXISTS (SELECT 1 FROM public.notifications m
                 WHERE m.recipient_user_id = n.recipient_user_id
                   AND m.type = n.type AND m.title = n.title
                   AND m.created_at > n.created_at)
         OR EXISTS (SELECT 1 FROM public.hr_employees e
                    JOIN public.att_records r ON r.employee_id = e.id AND r.date = _today
                    WHERE e.auth_user_id = n.recipient_user_id AND r.check_out IS NOT NULL));

  SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today, r.shift_id) w
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND COALESCE(e.discord_user_id, '') <> ''
    AND _now >= w.end_time + interval '30 minutes'
    AND _now <  w.end_time + interval '45 minutes';

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
