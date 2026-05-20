-- Trigger function: gọi notify-email Edge Function qua pg_net khi có notification mới
-- Dùng net.http_post() (pg_net schema), KHÔNG phải extensions.http_post()
CREATE OR REPLACE FUNCTION public.trigger_notify_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'type',       'INSERT',
    'table',      'notifications',
    'schema',     'public',
    'record',     row_to_json(NEW)::jsonb,
    'old_record', NULL
  );

  PERFORM net.http_post(
    url     := 'https://fifuhkupaqcfjwyouwpa.supabase.co/functions/v1/notify-email',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZnVoa3VwYXFjZmp3eW91d3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDUyMjIsImV4cCI6MjA4NjkyMTIyMn0.tA8a5ElWwsupGZiNEG-1QMgMDJgykP6LNnxuVuZvwBY'
    ),
    body    := _payload,
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Không bao giờ block INSERT kể cả khi HTTP call thất bại
  RETURN NEW;
END;
$$;

-- Trigger trên notifications table
DROP TRIGGER IF EXISTS on_notification_email ON public.notifications;
CREATE TRIGGER on_notification_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_email();
