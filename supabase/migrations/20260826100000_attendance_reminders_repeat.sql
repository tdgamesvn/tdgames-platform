-- Nhắc chấm công lặp 15 phút/lần thay vì bắn một phát rồi thôi.
-- Check-in: từ giờ vào ca, lặp tới khi chấm hoặc hết cửa sổ.
-- Check-out: từ giờ tan ca + độ trễ, lặp tới khi chấm hoặc hết cửa sổ.
--
-- Giờ lấy từ att_shifts (ca active) chứ không hardcode ⇒ HR đổi giờ ca là nhắc đổi theo,
-- không cần migration mới.
--
-- ponytail: cửa sổ nhắc là 2 hằng số dưới đây, sửa tại chỗ là xong. Chưa làm bảng cấu hình
-- vì mới có đúng 1 ca hành chính và chưa ai đòi mỗi phòng ban một kiểu nhắc.
--   check-in : [giờ vào ca            → +1 giờ]      ⇒ 08:30, 08:45, 09:00, 09:15  (4 lần)
--   check-out: [giờ tan ca + 30 phút  → +2 giờ 30]   ⇒ 18:00 … 20:00               (9 lần)
-- Trễ 30 phút bên check-out để người vừa tan ca kịp tự bấm, và để người tăng ca không bị
-- nhắc ngay lúc còn đang ngồi làm.

-- ── Nhắc check-in ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_missing_checkin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now   time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _start time;
BEGIN
  SELECT s.start_time INTO _start
  FROM public.att_shifts s WHERE s.is_active ORDER BY s.created_at LIMIT 1;
  _start := COALESCE(_start, '08:30');

  -- Ngoài cửa sổ thì thôi. Cron chạy thưa hơn cửa sổ nên phải chặn ở đây, không chặn ở cron.
  -- Chặn trên là "<" chứ không "<=": 08:30 → 09:15 là 4 lượt, không dính thêm lượt 09:30.
  IF _now < _start OR _now >= _start + interval '1 hour' THEN RETURN; END IF;

  -- Chuông chỉ nên có 1 dòng "chưa check-in", không phải 4 dòng giống hệt nhau. Xoá bản
  -- chưa đọc của lượt trước; mốc 14 phút để lượt vừa bắn (≤15 phút trước) còn nguyên làm
  -- chốt chống nhắc chồng cho NOT EXISTS bên dưới khi cron bị chạy lại.
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
END;
$$;

-- ── Nhắc check-out ──────────────────────────────────────────────────────────
-- Không cần att_should_check_today: đã có check_in nghĩa là hôm đó đi làm thật.
CREATE OR REPLACE FUNCTION public.notify_missing_checkout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _now   time := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time;
  _end   time;
BEGIN
  SELECT s.end_time INTO _end
  FROM public.att_shifts s WHERE s.is_active ORDER BY s.created_at LIMIT 1;
  _end := COALESCE(_end, '17:30');

  IF _now < _end + interval '30 minutes' OR _now > _end + interval '2 hours 30 minutes'
    THEN RETURN; END IF;

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
END;
$$;

-- ── Lịch chạy ───────────────────────────────────────────────────────────────
-- Cron chỉ là cái đồng hồ gõ 15 phút/lần; cửa sổ nhắc thật nằm trong 2 hàm trên.
-- Khung 0-16 UTC = 07:00–23:45 giờ VN, dư sức bao ca hành chính lẫn ca HR chỉnh lệch vài giờ.
-- ponytail: ca qua đêm (tan ca sau 00:00) sẽ rơi ra ngoài khung này — lúc nào có ca đêm thật
-- thì nới cron thành '*/15 * * * 1-5' và xử lý mốc ngày trong hàm.
SELECT cron.unschedule('attendance-remind-checkin')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkin');
SELECT cron.unschedule('attendance-remind-checkout') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendance-remind-checkout');

SELECT cron.schedule('attendance-remind-checkin',  '*/15 0-16 * * 1-5', 'SELECT public.notify_missing_checkin()');
SELECT cron.schedule('attendance-remind-checkout', '*/15 0-16 * * 1-5', 'SELECT public.notify_missing_checkout()');
