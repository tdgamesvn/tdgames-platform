-- ══════════════════════════════════════════════════════════════════════════════
-- Fix x3 Discord notifications
--
-- Root cause:
--   notify_discord_admin_forward used pg_try_advisory_xact_lock for dedup,
--   but advisory locks are RE-ENTRANT within the same transaction → dedup fails.
--   When multiple admin users exist, each gets a notification row, and each
--   triggers a separate Discord webhook call.
--
-- Fix:
--   Replace advisory lock with row-comparison dedup. Only the notification
--   with the lexicographically smallest UUID fires Discord; the rest skip.
--   This works because all notifications from the same trigger share the
--   same created_at (transaction timestamp).
--
-- Scope: global — applies to ALL notification types (leave, eval, CRM, etc.)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_discord_admin_forward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role        text;
  _discord_url text;
  _emoji       text;
  _color       int;
BEGIN
  -- Check if recipient is admin
  SELECT raw_user_meta_data->>'role'
  INTO   _role
  FROM   auth.users
  WHERE  id = NEW.recipient_user_id
  LIMIT  1;

  IF _role IS DISTINCT FROM 'admin' THEN
    RETURN NEW;
  END IF;

  -- Dedup: only send Discord for the FIRST admin notification with this content.
  -- Advisory locks are re-entrant (same transaction = always TRUE), so use row check instead.
  -- All notifications from the same trigger share the same created_at (transaction timestamp).
  PERFORM 1 FROM public.notifications
  WHERE  type = NEW.type
    AND  title = NEW.title
    AND  created_at = NEW.created_at
    AND  id::text < NEW.id::text
  LIMIT 1;

  IF FOUND THEN
    RETURN NEW;  -- earlier admin notification already sent Discord
  END IF;

  -- Read webhook URL from app_config
  SELECT value INTO _discord_url
  FROM   public.app_config
  WHERE  key = 'discord_admin_webhook'
  LIMIT  1;

  IF _discord_url IS NULL OR _discord_url = '' THEN
    RETURN NEW;
  END IF;

  -- Map notification type → emoji + color
  _emoji := CASE
    WHEN NEW.type LIKE 'leave_%'           THEN '📅'
    WHEN NEW.type LIKE 'contract_%'        THEN '📋'
    WHEN NEW.type LIKE 'eval_%'            THEN '📊'
    WHEN NEW.type LIKE 'change_request_%'  THEN '🔄'
    WHEN NEW.type LIKE 'payslip_%'         THEN '💰'
    ELSE '🔔'
  END;

  _color := CASE
    WHEN NEW.type LIKE 'leave_%'           THEN 2211607
    WHEN NEW.type LIKE 'contract_%'        THEN 16742656
    WHEN NEW.type LIKE 'eval_%'            THEN 10231216
    WHEN NEW.type LIKE 'change_request_%'  THEN 16753408
    ELSE 6318987
  END;

  PERFORM net.http_post(
    url     := _discord_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := json_build_object(
      'embeds', json_build_array(
        json_build_object(
          'title',  _emoji || ' ' || NEW.title,
          'color',  _color,
          'fields', json_build_array(
            json_build_object(
              'name',   '📝 Chi tiết',
              'value',  COALESCE(NEW.body, '—'),
              'inline', false
            )
          ),
          'footer', json_build_object(
            'text', 'TD Games Platform • ' ||
                    to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS')
          )
        )
      )
    )::jsonb
  );

  RETURN NEW;
END;
$$;
