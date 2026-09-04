-- Nhắc check-out lượt 3 mà vẫn chưa bấm ⇒ tag người đó lên Discord kênh chấm công.
--
-- Lượt nhắc app = tan ca, +15', +30' ⇒ lượt 3 rơi trong [tan ca +30', tan ca +45'). Cron gõ
-- 15'/lần nên khung đó có đúng 1 tick (18:00 với ca hành chính). Dùng khung giờ thay vì đếm
-- notifications vì mỗi vòng đã xoá bản chưa đọc của lượt trước — không đếm được.
-- Gom tất cả người thiếu vào 1 tin, dùng webhook `discord_attendance_webhook` sẵn có
-- (cùng kênh đang đăng embed check-in/out).
-- ponytail: cron retry trong cùng khung ⇒ ping Discord 2 lần, vô hại. Cần chặt thì thêm marker.
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

  IF _now < _end OR _now > _end + interval '5 hours 30 minutes' THEN RETURN; END IF;

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
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-out%'
        AND n.created_at > now() - interval '14 minutes'
    );

  -- ── Lượt 3 vẫn chưa bấm ⇒ Discord ──────────────────────────────────────────
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
