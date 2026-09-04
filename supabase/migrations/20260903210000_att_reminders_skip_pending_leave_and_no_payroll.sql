-- Sếp 3/9: "Phương Anh xin nghỉ chưa duyệt vẫn bị nhắc? Toàn không tính lương vẫn bị nhắc chấm công?"
-- Cả hai đều đúng là đang bị. Vá:
--   1. Đơn nghỉ `pending` cũng coi là nghỉ (trước chỉ `approved`) — người đã nộp đơn thì khỏi nhắc.
--   2. `exclude_from_payroll = true` ⇒ không nhắc check-in lẫn check-out, không tag Discord.
-- Check-in đi qua att_should_check_today nên chỉ sửa hàm đó; check-out cố tình không dùng hàm này
-- (không lọc lễ) nên thêm điều kiện thẳng vào 2 truy vấn.
CREATE OR REPLACE FUNCTION public.att_should_check_today(_employee_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.att_requests q
    WHERE q.employee_id = _employee_id
      AND q.request_type = 'leave'
      AND q.status IN ('approved', 'pending')
      AND COALESCE(q.leave_type, '') <> 'remote'
      AND _date BETWEEN q.date_from AND q.date_to
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.att_holidays h
    WHERE _date BETWEEN h.date_from AND h.date_to
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.hr_employees e
    WHERE e.id = _employee_id AND e.exclude_from_payroll
  );
$$;

CREATE OR REPLACE FUNCTION public.notify_missing_checkout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now      time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _end      time;
  _url      text;
  _mentions text;
BEGIN
  SELECT s.end_time INTO _end
  FROM public.att_shifts s WHERE s.is_active ORDER BY s.created_at LIMIT 1;
  _end := COALESCE(_end, '17:30');

  IF _now < _end OR _now >= _end + interval '2 hours' THEN RETURN; END IF;

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
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-out%'
        AND n.created_at > now() - interval '14 minutes'
    );

  IF _now >= _end + interval '30 minutes' AND _now < _end + interval '45 minutes' THEN
    SELECT value INTO _url FROM public.app_config WHERE key = 'discord_attendance_webhook' LIMIT 1;

    SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
    FROM public.hr_employees e
    JOIN public.att_records r
      ON r.employee_id = e.id AND r.date = _today
     AND r.check_in IS NOT NULL AND r.check_out IS NULL
    WHERE e.status = 'active'
      AND e.type IN ('fulltime', 'parttime')
      AND e.auth_user_id IS NOT NULL
      AND NOT COALESCE(e.exclude_from_payroll, false)
      AND COALESCE(e.discord_user_id, '') <> '';

    IF COALESCE(_url, '') <> '' AND _mentions IS NOT NULL THEN
      PERFORM net.http_post(
        url     := _url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
          'content',
          '⚠️ ' || _mentions || ' — app đã nhắc 3 lần mà vẫn chưa check-out hôm nay. '
          || 'Bấm giờ ra ngay nhé: https://app.tdgamestudio.com/#portal/tasks'
        )
      );
    END IF;
  END IF;
END;
$$;
