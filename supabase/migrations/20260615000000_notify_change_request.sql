-- ══════════════════════════════════════════════════════════════════════════════
-- Notification trigger for hr_change_requests
--
-- When a change request moves to approved / rejected, INSERT a notification
-- for the affected employee.  The existing on_notification_email webhook
-- (trigger_notify_email) picks it up and sends an email via Resend.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_change_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id    uuid;
  _emp_name   text;
  _ntype      text;
  _title      text;
  _body       text;
  _type_label text;
BEGIN
  -- Only fire when status actually changes
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Only handle final statuses
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  -- Resolve employee's auth account
  SELECT auth_user_id, full_name
  INTO   _user_id, _emp_name
  FROM   hr_employees
  WHERE  id = NEW.employee_id
  LIMIT  1;

  -- No platform account → skip silently
  IF _user_id IS NULL THEN RETURN NEW; END IF;

  -- Map request_type to Vietnamese label
  _type_label := CASE NEW.request_type
    WHEN 'probation_end'        THEN 'Kết thúc thử việc'
    WHEN 'salary_change'        THEN 'Điều chỉnh lương'
    WHEN 'promotion'            THEN 'Thăng chức'
    WHEN 'department_transfer'  THEN 'Chuyển phòng ban'
    WHEN 'termination'          THEN 'Nghỉ việc'
    ELSE NEW.request_type
  END;

  -- Build notification type + content
  _ntype := CASE NEW.status
    WHEN 'approved' THEN 'change_request_approved'
    ELSE                  'change_request_rejected'
  END;

  _title := CASE NEW.status
    WHEN 'approved' THEN 'Đề xuất thay đổi nhân sự được duyệt'
    ELSE                  'Đề xuất thay đổi nhân sự bị từ chối'
  END;

  _body := _type_label
    || ' — Hiệu lực: ' || to_char(NEW.effective_date, 'DD/MM/YYYY')
    || CASE WHEN NEW.approval_note IS NOT NULL AND NEW.approval_note <> ''
            THEN ' — Ghi chú: ' || NEW.approval_note
            ELSE ''
       END;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_user_id, _ntype, _title, _body, '#hr');

  RETURN NEW;
END;
$$;

-- Trigger fires on status column update only
DROP TRIGGER IF EXISTS trg_notify_change_request_status ON public.hr_change_requests;
CREATE TRIGGER trg_notify_change_request_status
  AFTER UPDATE OF status ON public.hr_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_change_request_status();
