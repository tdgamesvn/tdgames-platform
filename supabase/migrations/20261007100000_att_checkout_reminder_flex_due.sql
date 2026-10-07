-- Nhắc check-out theo GIỜ VỀ RIÊNG của từng người (giờ linh hoạt 30 phút).
--
-- Quy định: ca 8:30–17:30, được đến muộn tối đa 30p nhưng phải về muộn bù đủ 9 tiếng.
--   check-in 8:20 → về 17:30 (đến sớm không được về sớm)
--   check-in 8:50 → về 17:50
--   check-in 9:15 → về 18:00 (trần 30p — quá 30p là đi muộn, không kéo giờ về thêm)
--
-- Lỗi trước đây: nhắc lúc 17:30 cho TẤT CẢ ⇒ người đến 8:50 nhận noti khi còn 20p mới được về,
-- gạt đi, tới lúc về thật thì không còn gì nhắc ⇒ quên check-out (vd Bảo Anh 06/10).
--
-- Cron check-out đổi */15 → */5 để noti đến đúng giờ về riêng (sai lệch ≤5p thay vì ≤15p).
-- Khung tag Discord thu hẹp còn 5p cho khớp nhịp cron mới (mỗi người bị tag đúng 1 lần).

-- Giờ về riêng. Áp cho cả khung bị đơn nghỉ nửa ngày cắt (đi chiều 13:10 → về 17:40).
CREATE OR REPLACE FUNCTION public.att_checkout_due(_start time, _end time, _check_in time)
RETURNS time
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  -- ponytail: 30p linh hoạt hardcode; cần cấu hình theo ca thì thêm cột att_shifts.flex_minutes.
  SELECT CASE WHEN _check_in IS NULL THEN _end
              ELSE LEAST(_end + interval '30 minutes',
                         GREATEST(_end, _check_in + (_end - _start)))
         END;
$function$;

COMMENT ON FUNCTION public.att_checkout_due(time, time, time) IS
  'Giờ về riêng = check-in + độ dài khung, kẹp trong [hết khung, hết khung + 30p]. Dùng cho nhắc check-out + nút glow ở Portal.';


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

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  SELECT e.auth_user_id,
         'attendance_reminder',
         '🏁 Bạn chưa check-out hôm nay',
         'Đã đến giờ về của bạn (' || to_char(d.due, 'HH24:MI')
           || '). Nhớ bấm check-out trước khi rời văn phòng.',
         '#portal/tasks'
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today, r.shift_id) w
  CROSS JOIN LATERAL (SELECT public.att_checkout_due(
           w.start_time, w.end_time, (r.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time) AS due) d
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND _now >= d.due
    AND _now <  d.due + interval '2 hours'
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

  -- Tag Discord 30p sau giờ về riêng. Khung 5p = đúng 1 lượt cron */5.
  SELECT string_agg('<@' || e.discord_user_id || '>', ' ' ORDER BY e.full_name) INTO _mentions
  FROM public.hr_employees e
  JOIN public.att_records r
    ON r.employee_id = e.id AND r.date = _today
   AND r.check_in IS NOT NULL AND r.check_out IS NULL
  CROSS JOIN LATERAL public.att_expected_window(e.id, _today, r.shift_id) w
  CROSS JOIN LATERAL (SELECT public.att_checkout_due(
           w.start_time, w.end_time, (r.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time) AS due) d
  WHERE e.status = 'active'
    AND e.type IN ('fulltime', 'parttime')
    AND e.auth_user_id IS NOT NULL
    AND NOT COALESCE(e.exclude_from_payroll, false)
    AND COALESCE(e.discord_user_id, '') <> ''
    AND _now >= d.due + interval '30 minutes'
    AND _now <  d.due + interval '35 minutes';

  IF _mentions IS NOT NULL THEN
    SELECT value INTO _url FROM public.app_config WHERE key = 'discord_attendance_webhook' LIMIT 1;
    IF COALESCE(_url, '') <> '' THEN
      PERFORM net.http_post(
        url     := _url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object('content',
          '⚠️ ' || _mentions || ' — đã quá giờ về 30 phút mà vẫn chưa check-out hôm nay. '
          || 'Bấm giờ ra ngay nhé: https://app.tdgamestudio.com/#portal/tasks'));
    END IF;
  END IF;
END;
$function$;


-- RPC cho Portal: giờ vào / giờ về riêng của CHÍNH MÌNH hôm nay ⇒ nút check-in/out phát sáng
-- đúng lúc. Chỉ trả dữ liệu của auth.uid() — không nhận employee_id từ client.
CREATE OR REPLACE FUNCTION public.att_my_today_schedule()
RETURNS TABLE (start_time time, end_time time, checkout_due time, should_check boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _emp   uuid;
  _rec   att_records;
BEGIN
  SELECT e.id INTO _emp FROM hr_employees e WHERE e.auth_user_id = auth.uid() LIMIT 1;
  IF _emp IS NULL THEN RETURN; END IF;

  SELECT * INTO _rec FROM att_records r WHERE r.employee_id = _emp AND r.date = _today;

  SELECT w.start_time, w.end_time, w.should_check
    INTO start_time, end_time, should_check
  FROM att_expected_window(_emp, _today, _rec.shift_id) w;

  checkout_due := att_checkout_due(start_time, end_time,
                    (_rec.check_in AT TIME ZONE 'Asia/Ho_Chi_Minh')::time);
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.att_my_today_schedule() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.att_my_today_schedule() TO authenticated;


-- Cron check-out: */15 → */5 (07:00–23:55 giờ VN).
SELECT cron.schedule('attendance-remind-checkout', '*/5 0-16 * * *',
                     'SELECT public.notify_missing_checkout()');
