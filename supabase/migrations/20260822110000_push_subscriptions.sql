-- Web Push: lưu subscription của trình duyệt/thiết bị + trigger gọi Edge Function notify-push.
--
-- Nối vào ĐÚNG CHỖ email đang nối (AFTER INSERT ON notifications) thay vì viết trigger
-- riêng cho từng nghiệp vụ → mọi loại thông báo hiện có và về sau tự động có push.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  endpoint   text PRIMARY KEY,                       -- endpoint là định danh duy nhất của 1 thiết bị
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Trigger: notification mới → gọi notify-push ─────────────────────────────
-- Copy nguyên pattern của trigger_notify_email (20260520035414).
CREATE OR REPLACE FUNCTION public.trigger_notify_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://fifuhkupaqcfjwyouwpa.supabase.co/functions/v1/notify-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZnVoa3VwYXFjZmp3eW91d3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDUyMjIsImV4cCI6MjA4NjkyMTIyMn0.tA8a5ElWwsupGZiNEG-1QMgMDJgykP6LNnxuVuZvwBY'
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'notifications',
      'schema', 'public',
      'record', row_to_json(NEW)::jsonb
    ),
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Không bao giờ block INSERT kể cả khi HTTP call thất bại
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_push();
