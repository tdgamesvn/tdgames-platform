-- Đồng bộ luật nhắc check-in / check-out (yêu cầu sếp 3/9):
--   * Cả hai: nhắc 15'/lần, tối đa 2 giờ kể từ mốc ca (8 lượt) — trước check-in 1h (4 lượt),
--     check-out 5h30 (23 lượt, nhắc tới 23:00 là quá nhiều).
--   * Cả hai: lượt 3 vẫn chưa bấm ⇒ tag lên Discord kênh chấm công (check-out đã có từ
--     20260903190000, nay thêm cho check-in). Lượt 3 = tick nằm trong [mốc +30', mốc +45')
--     ⇒ 09:00 cho check-in, 18:00 cho check-out với ca hành chính.
-- ponytail: cron retry trong khung 15' ⇒ ping Discord 2 lần, vô hại. Cần chặt thì thêm marker.

-- ── Nhắc check-in ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_missing_checkin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today    date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now      time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _start    time;
  _url      text;
  _mentions text;
BEGIN
  SELECT s.start_time INTO _start
  FROM public.att_shifts s WHERE s.is_active ORDER BY s.created_at LIMIT 1;
  _start := COALESCE(_start, '08:30');

  IF _now < _start OR _now >= _start + interval '2 hours' THEN RETURN; END IF;

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
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND public.att_should_check_today(e.id, _today)
    AND NOT EXISTS (
      SELECT 1 FROM public.att_records r
      WHERE r.employee_id = e.id AND r.date = _today AND r.check_in IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-in%'
        AND n.created_at > now() - interval '14 minutes'
    );

  -- ── Lượt 3 vẫn chưa bấm ⇒ Discord ──────────────────────────────────────────
  IF _now >= _start + interval '30 minutes' AND _now < _start + interval '45 minutes' THEN
    SELECT value INTO _url FROM public.app_config WHERE key = 'discord_attendance_webhook' LIMIT 1;

    SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
    FROM public.hr_employees e
    WHERE e.status = 'active'
      AND e.type IN ('fulltime', 'parttime')
      AND e.auth_user_id IS NOT NULL
      AND COALESCE(e.discord_user_id, '') <> ''
      AND public.att_should_check_today(e.id, _today)
      AND NOT EXISTS (
        SELECT 1 FROM public.att_records r
        WHERE r.employee_id = e.id AND r.date = _today AND r.check_in IS NOT NULL
      );

    IF COALESCE(_url, '') <> '' AND _mentions IS NOT NULL THEN
      PERFORM net.http_post(
        url     := _url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
          'content',
          '⚠️ ' || _mentions || ' — app đã nhắc 3 lần mà vẫn chưa check-in hôm nay. '
          || 'Bấm giờ vào ngay nhé: https://app.tdgamestudio.com/#portal/tasks'
        )
      );
    END IF;
  END IF;
END;
$$;

-- ── Nhắc check-out ──────────────────────────────────────────────────────────
-- Chỉ đổi trần cửa sổ 5h30 → 2h. Phần Discord giữ nguyên 20260903190000.
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
