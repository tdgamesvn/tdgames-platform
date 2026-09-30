-- update_clickup_sync_schedule tạo cron gọi clickup-auto-sync KHÔNG kèm x-cron-secret.
-- Từ 2026-08-26 (commit 79adb42) function đòi x-cron-secret hoặc JWT ⇒ ai bấm "Lưu lịch"
-- trong Workforce › ClickUp là xoá cron đang chạy, thay bằng cron nhận 401 — auto-sync chết
-- âm thầm. Sửa: header lấy secret từ crm_outreach_config LÚC CRON CHẠY (subquery nằm trong
-- câu lệnh), giống cron tạo tay; không nhúng secret vào cron.job.command.
-- Phần còn lại (guard admin/ke_toan, giờ VN → UTC, tên job) giữ nguyên bản 20260809160000.
create or replace function public.update_clickup_sync_schedule(p_times text[], p_enabled boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
DECLARE
  v_time text;
  v_hour int;
  v_minute int;
  v_utc_hour int;
  v_job_name text;
  v_count int := 0;
  v_fn_url text;
BEGIN
  IF NOT public.jwt_has_any_role(ARRAY['admin', 'ke_toan']) THEN
    RAISE EXCEPTION 'forbidden: update_clickup_sync_schedule';
  END IF;

  v_fn_url := 'https://fifuhkupaqcfjwyouwpa.supabase.co/functions/v1/clickup-auto-sync';

  DELETE FROM cron.job WHERE jobname LIKE 'clickup-auto-sync-%';

  IF NOT p_enabled THEN
    UPDATE wf_clickup_config SET auto_sync_times = p_times, auto_sync_enabled = false, updated_at = now();
    RETURN jsonb_build_object('ok', true, 'enabled', false, 'jobs_created', 0);
  END IF;

  FOREACH v_time IN ARRAY p_times
  LOOP
    v_hour := split_part(v_time, ':', 1)::int;
    v_minute := split_part(v_time, ':', 2)::int;
    v_utc_hour := (v_hour - 7 + 24) % 24;

    v_job_name := 'clickup-auto-sync-' || v_count;
    v_count := v_count + 1;

    PERFORM cron.schedule(
      v_job_name,
      v_minute || ' ' || v_utc_hour || ' * * *',
      format(
        'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT value #>> ''{}'' FROM crm_outreach_config WHERE key = ''cron_secret'')), body := ''{}''::jsonb) AS request_id;',
        v_fn_url
      )
    );
  END LOOP;

  UPDATE wf_clickup_config SET auto_sync_times = p_times, auto_sync_enabled = p_enabled, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'enabled', true, 'jobs_created', v_count);
END;
$$;

revoke execute on function public.update_clickup_sync_schedule(text[], boolean) from public, anon;
grant execute on function public.update_clickup_sync_schedule(text[], boolean) to authenticated;
