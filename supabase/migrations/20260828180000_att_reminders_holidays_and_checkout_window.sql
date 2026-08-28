-- Hai vá cho luồng nhắc chấm công.
--
-- 1. NGÀY LỄ. Migration gốc (20260824030000) ghi thẳng trong comment: "chưa có bảng ngày lễ
--    nên chỉ loại được T7/CN — ngày lễ Tết vẫn bị nhắc". Giờ `att_holidays` đã có thật (đang
--    được `att_compute_late_early` dùng), nên trả nốt món nợ đó. Không vá thì 29/8–2/9 tới
--    cả công ty ăn 4 lượt nhắc check-in mỗi ngày suốt 5 ngày nghỉ Quốc khánh.
--    Chỉ chặn ở nhắc CHECK-IN. Nhắc check-out cố tình không lọc lễ: ai đã check-in ngày lễ
--    nghĩa là có đi làm thật, càng phải nhắc bấm giờ ra.
--
-- 2. CỬA SỔ NHẮC CHECK-OUT. Trước: tan ca +30' → +2h30 (18:00–20:00, 9 lượt). Độ trễ 30 phút
--    dựng lên để người tăng ca khỏi bị nhắc sớm, nhưng thực tế người quên bấm là người đã
--    đứng dậy đi về lúc 17:30 — nhắc lúc 18:00 thì họ ra khỏi văn phòng rồi.
--    Sau: tan ca → tan ca +5h30 (17:30–23:00, 23 lượt), vẫn dừng ngay khi bấm giờ ra.
--    Trần 5h30 để rơi gọn trong khung cron 0-16 UTC (= 07:00–23:45 VN), không phải nới cron.
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
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.att_holidays h
    WHERE _date BETWEEN h.date_from AND h.date_to
  );
$$;

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
END;
$$;
