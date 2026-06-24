-- ══════════════════════════════════════════════════════════════════════════════
-- CRM Document Approval — columns + notification triggers
--
-- 1. ALTER crm_documents: add approval_status, created_by, approved_by, approved_at
-- 2. Trigger on INSERT (pending_approval) → notify admin users (email + Discord)
-- 3. Trigger on UPDATE (approved/rejected) → notify document creator (email + Discord)
--
-- Email: flows through existing notify-email edge function via notifications table
-- Discord: direct pg_net call to admin webhook
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Add columns (idempotent) ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_documents' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.crm_documents
      ADD COLUMN approval_status text DEFAULT NULL,
      ADD COLUMN created_by      uuid DEFAULT NULL REFERENCES auth.users(id),
      ADD COLUMN approved_by     uuid DEFAULT NULL REFERENCES auth.users(id),
      ADD COLUMN approved_at     timestamptz DEFAULT NULL;
  END IF;
END$$;

-- Index for quick filtering by status
CREATE INDEX IF NOT EXISTS idx_crm_documents_approval_status
  ON public.crm_documents (approval_status)
  WHERE approval_status IS NOT NULL;

-- ── 2. Trigger: new document pending approval → notify all admins ───────────
CREATE OR REPLACE FUNCTION public.notify_crm_document_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin     RECORD;
  _client    text;
  _creator   text;
  _body      text;
BEGIN
  -- Only fire for pending_approval documents
  IF NEW.approval_status <> 'pending_approval' THEN RETURN NEW; END IF;

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

  -- Discord webhook — admin channel
  PERFORM net.http_post(
    url     := 'https://discord.com/api/webhooks/1506536432347516929/N74vGob7FrHrlK1wgxmoz0NOxOCK4WY4x2VQCZiafpRC4hHja8YcwcoqGL3CZuydjpML',
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_crm_document_pending ON public.crm_documents;
CREATE TRIGGER trg_notify_crm_document_pending
  AFTER INSERT ON public.crm_documents
  FOR EACH ROW
  WHEN (NEW.approval_status = 'pending_approval')
  EXECUTE FUNCTION public.notify_crm_document_pending();

-- ── 3. Trigger: approval status changed → notify creator ────────────────────
CREATE OR REPLACE FUNCTION public.notify_crm_document_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator_id uuid;
  _client     text;
  _approver   text;
  _ntype      text;
  _title      text;
  _body       text;
  _discord_color int;
  _discord_icon  text;
BEGIN
  -- Only fire when approval_status actually changes to approved/rejected
  IF NEW.approval_status = OLD.approval_status THEN RETURN NEW; END IF;
  IF NEW.approval_status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  _creator_id := NEW.created_by;
  IF _creator_id IS NULL THEN RETURN NEW; END IF;

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
    _ntype := 'contract_approved';
    _title := 'Hợp đồng đã được duyệt';
    _discord_color := 5025616;   -- #4CAF50
    _discord_icon  := '✅';
  ELSE
    _ntype := 'contract_rejected';
    _title := 'Hợp đồng bị từ chối';
    _discord_color := 15998776;  -- #F44336 → 0xF44338
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

  -- Discord webhook — admin channel
  PERFORM net.http_post(
    url     := 'https://discord.com/api/webhooks/1506536432347516929/N74vGob7FrHrlK1wgxmoz0NOxOCK4WY4x2VQCZiafpRC4hHja8YcwcoqGL3CZuydjpML',
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_crm_document_reviewed ON public.crm_documents;
CREATE TRIGGER trg_notify_crm_document_reviewed
  AFTER UPDATE OF approval_status ON public.crm_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_crm_document_reviewed();
