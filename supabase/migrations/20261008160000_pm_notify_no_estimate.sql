-- Noti 08:30 cho PM + admin: gộp "task đứng lâu" + "task đang làm chưa có Time Estimate".
-- Chỉ nhắc estimate cho task TẠO từ 2026-10-08 (mốc chuẩn hoá, sếp chốt) — task cũ đều trống, nhắc
-- sẽ thành nhiễu. Khớp ESTIMATE_REQUIRED_FROM trong apps/projects/services/projectService.ts.

CREATE OR REPLACE FUNCTION public.pm_notify_stuck_tasks()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE _n int; _cnt int; _top text; _noest int; _title text; _body text;
        _today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  WITH last AS (
    SELECT DISTINCT ON (l.task_id) l.task_id, lower(trim(l.to_status)) st, l.changed_at
    FROM wf_task_status_log l ORDER BY l.task_id, l.changed_at DESC
  ), stuck AS (
    SELECT t.title, extract(epoch FROM now() - last.changed_at) / 3600 AS h
    FROM last
    JOIN wf_tasks t ON t.id = last.task_id AND lower(trim(t.clickup_status)) = last.st
    JOIN wf_status_categories c ON c.status = last.st
    WHERE (c.category = 'active' AND now() - last.changed_at > interval '48 hours')
       OR (c.category = 'waiting_client' AND now() - last.changed_at > interval '120 hours')
  )
  SELECT count(*), string_agg(title || ' (' || floor(h / 24) || 'd)', ', ' ORDER BY h DESC)
    INTO _cnt, _top FROM stuck;

  SELECT count(*) INTO _noest
  FROM wf_tasks t JOIN wf_status_categories c ON c.status = lower(trim(t.clickup_status)) AND c.category = 'active'
  WHERE t.time_estimate_hours IS NULL AND t.start_date >= date '2026-10-08';

  IF _cnt = 0 AND _noest = 0 THEN RETURN 0; END IF;

  _title := concat_ws(' · ',
    CASE WHEN _cnt > 0 THEN '⏳ ' || _cnt || ' task đứng lâu' END,
    CASE WHEN _noest > 0 THEN '⏱ ' || _noest || ' task chưa ước lượng' END);
  _body := CASE WHEN _cnt > 0 THEN left(_top, 220) || CASE WHEN length(_top) > 220 THEN '…' ELSE '' END
                ELSE 'Nhập Time Estimate trên ClickUp cho task đang làm' END;

  WITH rcpt AS (
    SELECT u.id FROM auth.users u
    WHERE (u.banned_until IS NULL OR u.banned_until < now())
      AND (u.raw_app_meta_data->>'role' IN ('admin','pm')
           OR COALESCE(u.raw_app_meta_data->'secondary_roles', '[]'::jsonb) ? 'pm')
      AND u.email NOT LIKE '%@tdgames.local'
  ), ins AS (
    INSERT INTO notifications (recipient_user_id, type, title, body, link, metadata)
    SELECT r.id, 'pm_stuck_tasks', _title, _body, '#projects/overview',
           jsonb_build_object('stuck', _cnt, 'no_estimate', _noest, 'date', _today)
    FROM rcpt r
    WHERE NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_user_id = r.id AND n.type = 'pm_stuck_tasks'
                        AND (n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = _today)
    RETURNING 1
  ) SELECT count(*) INTO _n FROM ins;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.pm_notify_stuck_tasks() FROM PUBLIC, anon, authenticated;
