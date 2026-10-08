-- Thông báo trong app cho PM + admin: task "đứng lâu" ở cùng trạng thái.
-- Ngưỡng khớp UI (projectService.STUCK_HOURS): đang làm > 48h, chờ khách > 120h (giờ đồng hồ).
-- 08:30 VN mỗi ngày (01:30 UTC). 1 noti tổng hợp / người / ngày. Không gửi nếu không có task đứng.

CREATE OR REPLACE FUNCTION public.pm_notify_stuck_tasks()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _n int; _cnt int; _top text; _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  WITH last AS (
    SELECT DISTINCT ON (l.task_id) l.task_id, lower(trim(l.to_status)) st, l.changed_at
    FROM wf_task_status_log l ORDER BY l.task_id, l.changed_at DESC
  ), stuck AS (
    SELECT t.title, c.category, extract(epoch FROM now() - last.changed_at) / 3600 AS h
    FROM last
    JOIN wf_tasks t ON t.id = last.task_id AND lower(trim(t.clickup_status)) = last.st  -- log khớp trạng thái hiện tại
    JOIN wf_status_categories c ON c.status = last.st
    WHERE (c.category = 'active' AND now() - last.changed_at > interval '48 hours')
       OR (c.category = 'waiting_client' AND now() - last.changed_at > interval '120 hours')
  )
  SELECT count(*), string_agg(title || ' (' || floor(h / 24) || 'd)', ', ' ORDER BY h DESC)
    INTO _cnt, _top
  FROM (SELECT * FROM stuck ORDER BY h DESC) s;

  IF _cnt = 0 THEN RETURN 0; END IF;
  _top := left(_top, 220) || CASE WHEN length(_top) > 220 THEN '…' ELSE '' END;

  WITH rcpt AS (
    SELECT u.id FROM auth.users u
    WHERE (u.banned_until IS NULL OR u.banned_until < now())
      AND (u.raw_app_meta_data->>'role' IN ('admin','pm')
           OR COALESCE(u.raw_app_meta_data->'secondary_roles', '[]'::jsonb) ? 'pm')
      AND u.email NOT LIKE '%@tdgames.local'   -- bỏ tài khoản test
  ), ins AS (
    INSERT INTO notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT r.id, 'pm_stuck_tasks', '⏳ ' || _cnt || ' task đứng lâu', _top, '#projects/overview',
           jsonb_build_object('count', _cnt, 'date', _today)
    FROM rcpt r
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_user_id = r.id AND n.type = 'pm_stuck_tasks'
                        AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today)
    RETURNING 1
  ) SELECT count(*) INTO _n FROM ins;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.pm_notify_stuck_tasks() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('pm-stuck-tasks-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pm-stuck-tasks-daily');
END $$;
SELECT cron.schedule('pm-stuck-tasks-daily', '30 1 * * *', 'SELECT public.pm_notify_stuck_tasks()');
