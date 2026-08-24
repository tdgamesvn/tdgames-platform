-- Nhắc chấm công: ai chưa check-in / chưa check-out thì bắn notification.
-- Không dựng Edge Function: insert vào public.notifications là 2 trigger sẵn có tự lo
-- push (notify-push) và Discord (chỉ khi người nhận là admin).
--
-- ponytail: chưa có bảng ngày lễ trong hệ thống nên chỉ loại được T7/CN (cron `1-5`).
-- Ngày lễ Tết vẫn bị nhắc — thêm bảng att_holidays rồi NOT EXISTS thêm một mệnh đề nữa
-- là xong, chưa làm vì chưa có nguồn dữ liệu ngày lễ.

-- ── Ai đang trong diện phải chấm công hôm nay ────────────────────────────────
CREATE OR REPLACE FUNCTION public.att_should_check_today(_employee_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    -- Đơn nghỉ đã duyệt phủ ngày này ⇒ khỏi nhắc.
    -- leave_type='remote' KHÔNG tính: làm tại nhà vẫn phải chấm công, chỉ là bỏ qua GPS.
    SELECT 1 FROM public.att_requests q
    WHERE q.employee_id = _employee_id
      AND q.request_type = 'leave'
      AND q.status = 'approved'
      AND COALESCE(q.leave_type, '') <> 'remote'
      AND _date BETWEEN q.date_from AND q.date_to
  );
$$;

-- ── Nhắc check-in ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_missing_checkin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
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
    -- Cron chạy lại (retry/deploy) không được nhắc chồng trong cùng một ngày.
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_user_id = e.auth_user_id
        AND n.type = 'attendance_reminder'
        AND n.title LIKE '%check-in%'
        AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today
    );
END;
$$;

-- ── Nhắc check-out ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_missing_checkout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
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
        AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today
    );
END;
$$;

-- ── Không gửi email cho loại nhắc này ───────────────────────────────────────
-- Push + chuông trong app là đủ; email mỗi ngày sẽ thành spam và Gmail sẽ học cách
-- ném cả các thông báo khác của hệ thống vào Promotions.
DROP TRIGGER IF EXISTS on_notification_email ON public.notifications;
CREATE TRIGGER on_notification_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.type <> 'attendance_reminder')
  EXECUTE FUNCTION public.trigger_notify_email();

-- ── Lịch chạy (giờ UTC, VN = UTC+7) ─────────────────────────────────────────
-- Ca hành chính 08:30–17:30 ⇒ nhắc vào 09:15 và 18:00 giờ VN, chỉ T2–T6.
SELECT cron.unschedule('attendance-remind-checkin')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkin');
SELECT cron.unschedule('attendance-remind-checkout') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkout');

SELECT cron.schedule('attendance-remind-checkin',  '15 2 * * 1-5', 'SELECT public.notify_missing_checkin()');
SELECT cron.schedule('attendance-remind-checkout', '0 11 * * 1-5', 'SELECT public.notify_missing_checkout()');
