-- ══════════════════════════════════════════════════════════════════════════════
-- Fix Discord webhook hardcoded URLs in trigger functions
--
-- Security patch: removes hardcoded webhook URLs from source code.
-- URLs are now read at runtime from the database setting:
--   app.discord_admin_webhook  (set via ALTER DATABASE or Supabase dashboard)
--
-- To configure after deploying this migration, run in Supabase SQL editor:
--   ALTER DATABASE postgres SET "app.discord_admin_webhook" = 'YOUR_NEW_WEBHOOK_URL';
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Rewrite notify_crm_document_pending ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_crm_document_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin          RECORD;
  _client         text;
  _creator        text;
  _body           text;
  _discord_url    text;
BEGIN
  -- Only fire for pending_approval documents
  IF NEW.approval_status <> 'pending_approval' THEN RETURN NEW; END IF;

  -- Read webhook URL from DB setting (NULL-safe: returns '' if not configured)
  _discord_url := current_setting('app.discord_admin_webhook', true);

  -- Resolve client name
  SELECT name INTO _client
  FROM crm_clients WHERE id = NEW.client_id LIMIT 1;

  -- Resolve creator name
  SELECT COALESCE(e.full_name, u.email, 'Nhân viên')
  INTO   _creator
  FROM   auth.users u
  LEFT JOIN hr_employees e ON e.auth_user_id = u.id
  WHERE  u.id = NEW.created_by
  LIMIT  1;

  _body := COALESCE(_creator, 'BD') || ' đã tạo: ' || NEW.title
    || CASE WHEN _client IS NOT NULL THEN ' — KH: ' || _client ELSE '' END;

  -- Insert notification for each admin user → triggers notify-email edge function
  FOR _admin IN
    SELECT u.id FROM auth.users u
    WHERE (u.raw_user_meta_data->>'role') = 'admin'
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (
      _admin.id,
      'contract_pending_approval',
      'Hợp đồng mới cần duyệt',
      _body,
      '#crm'
    );
  END LOOP;

  -- Discord webhook — only send if URL is configured
  IF _discord_url IS NOT NULL AND _discord_url <> '' THEN
    PERFORM net.http_post(
      url     := _discord_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'embeds', json_build_array(
          json_build_object(
            'title',  '📋 Hợp đồng mới cần duyệt',
            'color',  16750374,  -- #FFA726
            'fields', json_build_array(
              json_build_object('name', '📄 Tài liệu', 'value', NEW.title, 'inline', false),
              json_build_object('name', '🏢 Khách hàng', 'value', COALESCE(_client, '—'), 'inline', true),
              json_build_object('name', '👤 Người tạo', 'value', COALESCE(_creator, '—'), 'inline', true)
            ),
            'footer', json_build_object('text', 'TD Games CRM • ' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'))
          )
        )
      )::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── Rewrite notify_crm_document_reviewed ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_crm_document_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id     uuid;
  _client         text;
  _approver       text;
  _ntype          text;
  _title          text;
  _body           text;
  _discord_color  int;
  _discord_icon   text;
  _discord_url    text;
BEGIN
  -- Only fire when approval_status actually changes to approved/rejected
  IF NEW.approval_status = OLD.approval_status THEN RETURN NEW; END IF;
  IF NEW.approval_status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  _creator_id  := NEW.created_by;
  IF _creator_id IS NULL THEN RETURN NEW; END IF;

  -- Read webhook URL from DB setting
  _discord_url := current_setting('app.discord_admin_webhook', true);

  -- Resolve client name
  SELECT name INTO _client
  FROM crm_clients WHERE id = NEW.client_id LIMIT 1;

  -- Resolve approver name
  SELECT COALESCE(e.full_name, u.email, 'Admin')
  INTO   _approver
  FROM   auth.users u
  LEFT JOIN hr_employees e ON e.auth_user_id = u.id
  WHERE  u.id = NEW.approved_by
  LIMIT  1;

  IF NEW.approval_status = 'approved' THEN
    _ntype         := 'contract_approved';
    _title         := 'Hợp đồng đã được duyệt';
    _discord_color := 5025616;   -- #4CAF50
    _discord_icon  := '✅';
  ELSE
    _ntype         := 'contract_rejected';
    _title         := 'Hợp đồng bị từ chối';
    _discord_color := 15998776;  -- #F44336
    _discord_icon  := '❌';
  END IF;

  _body := NEW.title
    || CASE WHEN _client IS NOT NULL THEN ' — KH: ' || _client ELSE '' END
    || ' — Duyệt bởi: ' || COALESCE(_approver, 'Admin')
    || CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> ''
            THEN ' — Ghi chú: ' || NEW.notes
            ELSE ''
       END;

  -- Notify the document creator
  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_creator_id, _ntype, _title, _body, '#crm');

  -- Discord webhook — only send if URL is configured
  IF _discord_url IS NOT NULL AND _discord_url <> '' THEN
    PERFORM net.http_post(
      url     := _discord_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'embeds', json_build_array(
          json_build_object(
            'title',  _discord_icon || ' ' || _title,
            'color',  _discord_color,
            'fields', json_build_array(
              json_build_object('name', '📄 Tài liệu', 'value', NEW.title, 'inline', false),
              json_build_object('name', '🏢 Khách hàng', 'value', COALESCE(_client, '—'), 'inline', true),
              json_build_object('name', '👤 Duyệt bởi', 'value', COALESCE(_approver, '—'), 'inline', true),
              json_build_object('name', '📝 Ghi chú', 'value', COALESCE(NEW.notes, '—'), 'inline', false)
            ),
            'footer', json_build_object('text', 'TD Games CRM • ' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'))
          )
        )
      )::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;
