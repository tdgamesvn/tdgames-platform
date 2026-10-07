-- Cron nhắc hạn HR Forms (khảo sát + đánh giá chéo) qua thông báo trong app (không email).
-- Chạy 08:00 giờ VN mỗi ngày. Nhắc người còn bài chưa nộp của form đang mở vào:
--   • ngày trước hạn (deadline - 1)  • ngày hạn chót (deadline)
-- Mỗi người chỉ nhận 1 noti / form / ngày (chạy lại cron trong ngày không nhân đôi).
-- Form không đặt deadline thì không nhắc tự động (HR vẫn bấm nhắc tay qua hr_form_remind).

CREATE OR REPLACE FUNCTION public.hr_forms_send_deadline_reminders()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  _n int;
BEGIN
  WITH pending AS (
    SELECT f.id AS form_id, f.title, f.kind, f.deadline, e.auth_user_id AS uid, count(*) AS cnt
    FROM public.hr_forms f
    JOIN public.hr_form_assignments a ON a.form_id = f.id AND a.submitted_at IS NULL
    JOIN public.hr_employees e ON e.id = a.respondent_employee_id AND e.auth_user_id IS NOT NULL
    WHERE f.status = 'open' AND f.deadline IN (_today, _today + 1)
    GROUP BY f.id, f.title, f.kind, f.deadline, e.auth_user_id
  ), noti AS (
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT p.uid, 'hr_form_deadline',
           CASE WHEN p.deadline = _today THEN '⏰ Hôm nay hết hạn: ' ELSE '⏰ Mai hết hạn: ' END || p.title,
           CASE WHEN p.kind = 'peer_review'
                THEN 'Bạn còn ' || p.cnt || ' đồng nghiệp chưa đánh giá'
                ELSE 'Bạn chưa nộp khảo sát' END
             || ' · hạn ' || to_char(p.deadline, 'DD/MM/YYYY'),
           '#portal/surveys', jsonb_build_object('form_id', p.form_id)
    FROM pending p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.type = 'hr_form_deadline' AND n.recipient_user_id = p.uid
        AND n.metadata->>'form_id' = p.form_id::text
        AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today)
    RETURNING 1
  ) SELECT count(*) INTO _n FROM noti;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.hr_forms_send_deadline_reminders() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('hr-forms-deadline-reminder')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hr-forms-deadline-reminder');
END $$;
SELECT cron.schedule('hr-forms-deadline-reminder', '0 1 * * *', 'SELECT public.hr_forms_send_deadline_reminders()');
