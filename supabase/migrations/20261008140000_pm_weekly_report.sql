-- Báo cáo tuần tự động (noti trong app) cho PM + admin — 08:30 VN thứ Hai (01:30 UTC).
-- Tuần trước = [T2 tuần trước, T2 tuần này) theo giờ VN. Số liệu lấy thẳng từ wf_* (cron không có JWT
-- nên không dùng được view pm_* — các view đó lọc theo role trong JWT).

CREATE OR REPLACE FUNCTION public.pm_send_weekly_report()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _mon date := date_trunc('week', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date;  -- T2 tuần này
  _from timestamptz := (_mon - 7)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  _to   timestamptz := _mon::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh';
  _delivered int; _fix int; _closed int; _stuck int; _body text; _n int;
BEGIN
  -- Giao khách lần đầu trong tuần (lần đầu sang client_review rơi vào tuần trước)
  SELECT count(*) INTO _delivered FROM (
    SELECT task_id, min(changed_at) f FROM wf_task_status_log
    WHERE lower(trim(to_status)) = 'client_review' GROUP BY task_id) x
  WHERE x.f >= _from AND x.f < _to;

  SELECT count(*) INTO _fix FROM wf_task_status_log
  WHERE lower(trim(to_status)) = 'fix' AND changed_at >= _from AND changed_at < _to;

  SELECT count(*) INTO _closed FROM wf_tasks
  WHERE COALESCE(closed_date, completed_at) >= _mon - 7 AND COALESCE(closed_date, completed_at) < _mon;

  -- Đứng lâu tính tại thời điểm gửi (ngưỡng như pm_notify_stuck_tasks)
  SELECT count(*) INTO _stuck FROM (
    SELECT DISTINCT ON (l.task_id) l.task_id, lower(trim(l.to_status)) st, l.changed_at
    FROM wf_task_status_log l ORDER BY l.task_id, l.changed_at DESC) last
  JOIN wf_tasks t ON t.id = last.task_id AND lower(trim(t.clickup_status)) = last.st
  JOIN wf_status_categories c ON c.status = last.st
  WHERE (c.category = 'active' AND now() - last.changed_at > interval '48 hours')
     OR (c.category = 'waiting_client' AND now() - last.changed_at > interval '120 hours');

  _body := _delivered || ' task giao khách · ' || _closed || ' task đóng · ' || _fix || ' lần chuyển FIX · '
           || _stuck || ' task đang đứng lâu';

  WITH rcpt AS (
    SELECT u.id FROM auth.users u
    WHERE (u.banned_until IS NULL OR u.banned_until < now())
      AND (u.raw_app_meta_data->>'role' IN ('admin','pm')
           OR COALESCE(u.raw_app_meta_data->'secondary_roles', '[]'::jsonb) ? 'pm')
      AND u.email NOT LIKE '%@tdgames.local'
  ), ins AS (
    INSERT INTO notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT r.id, 'pm_weekly_report',
           '📊 Tuần ' || to_char(_mon - 7, 'DD/MM') || '–' || to_char(_mon - 1, 'DD/MM'), _body, '#projects/metrics',
           jsonb_build_object('week', _mon - 7, 'delivered', _delivered, 'closed', _closed, 'fix', _fix, 'stuck', _stuck)
    FROM rcpt r
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_user_id = r.id AND n.type = 'pm_weekly_report'
                        AND n.metadata->>'week' = (_mon - 7)::text)
    RETURNING 1
  ) SELECT count(*) INTO _n FROM ins;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.pm_send_weekly_report() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('pm-weekly-report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pm-weekly-report');
END $$;
SELECT cron.schedule('pm-weekly-report', '30 1 * * 1', 'SELECT public.pm_send_weekly_report()');
