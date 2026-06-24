-- ══════════════════════════════════════════════════════════════════════════════
-- Centralized Discord forward for all admin notifications
--
-- Any notification inserted for a user with role='admin' is automatically
-- forwarded to the Discord admin webhook stored in app_config.
-- This replaces the per-function Discord calls in CRM trigger functions.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Centralized forward function ──────────────────────────────────────────
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
    WHEN NEW.type LIKE 'leave_%'           THEN 2211607   -- #2196F3 blue
    WHEN NEW.type LIKE 'contract_%'        THEN 16742656  -- #FF9500 orange
    WHEN NEW.type LIKE 'eval_%'            THEN 10231216  -- #9C27B0 purple
    WHEN NEW.type LIKE 'change_request_%'  THEN 16753408  -- #FFC107 yellow
    ELSE 6318987                                          -- #607D8B gray
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

-- ── 2. Attach trigger to notifications table ──────────────────────────────────
DROP TRIGGER IF EXISTS trg_discord_admin_forward ON public.notifications;
CREATE TRIGGER trg_discord_admin_forward
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_discord_admin_forward();

-- ── 3. Rewrite notify_crm_document_pending — remove direct Discord block ──────
--    (the centralized trigger now handles it via the admin notification insert)
CREATE OR REPLACE FUNCTION public.notify_crm_document_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin   RECORD;
  _client  text;
  _creator text;
  _body    text;
BEGIN
  IF NEW.approval_status <> 'pending_approval' THEN RETURN NEW; END IF;

  SELECT name INTO _client FROM crm_clients WHERE id = NEW.client_id LIMIT 1;

  SELECT COALESCE(e.full_name, u.email, 'Nhân viên')
  INTO   _creator
  FROM   auth.users u
  LEFT JOIN hr_employees e ON e.auth_user_id = u.id
  WHERE  u.id = NEW.created_by LIMIT 1;

  _body := COALESCE(_creator, 'BD') || ' đã tạo: ' || NEW.title
    || CASE WHEN _client IS NOT NULL THEN ' — KH: ' || _client ELSE '' END;

  -- Insert notification for each admin → trg_discord_admin_forward fires automatically
  FOR _admin IN
    SELECT u.id FROM auth.users u
    WHERE (u.raw_user_meta_data->>'role') = 'admin'
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (_admin.id, 'contract_pending_approval', 'Hợp đồng mới cần duyệt', _body, '#crm');
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 4. Rewrite notify_crm_document_reviewed — remove Discord block ────────────
--    (notification goes to creator/BD, not admin → no Discord needed)
CREATE OR REPLACE FUNCTION public.notify_crm_document_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id    uuid;
  _client        text;
  _approver      text;
  _ntype         text;
  _title         text;
  _body          text;
BEGIN
  IF NEW.approval_status = OLD.approval_status THEN RETURN NEW; END IF;
  IF NEW.approval_status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  _creator_id := NEW.created_by;
  IF _creator_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO _client FROM crm_clients WHERE id = NEW.client_id LIMIT 1;

  SELECT COALESCE(e.full_name, u.email, 'Admin')
  INTO   _approver
  FROM   auth.users u
  LEFT JOIN hr_employees e ON e.auth_user_id = u.id
  WHERE  u.id = NEW.approved_by LIMIT 1;

  IF NEW.approval_status = 'approved' THEN
    _ntype := 'contract_approved';
    _title := 'Hợp đồng đã được duyệt';
  ELSE
    _ntype := 'contract_rejected';
    _title := 'Hợp đồng bị từ chối';
  END IF;

  _body := NEW.title
    || CASE WHEN _client IS NOT NULL THEN ' — KH: ' || _client ELSE '' END
    || ' — Duyệt bởi: ' || COALESCE(_approver, 'Admin')
    || CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> ''
            THEN ' — Ghi chú: ' || NEW.notes ELSE '' END;

  -- Notify the document creator (BD/employee) — no Discord for this
  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_creator_id, _ntype, _title, _body, '#crm');

  RETURN NEW;
END;
$$;
