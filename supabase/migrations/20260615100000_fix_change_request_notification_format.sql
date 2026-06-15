-- ══════════════════════════════════════════════════════════════════════════════
-- Fix notification body format for hr_change_requests
--
-- Problems fixed:
--   1. Body was a single long line — now uses \n line breaks with bold labels
--   2. Salary summary was missing — now extracted from changes JSONB
--   3. Link was '#hr' (generic) — now deep-links to exact request card
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
  _salary_old numeric;
  _salary_new numeric;
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

  -- Build notification type + title
  _ntype := CASE NEW.status
    WHEN 'approved' THEN 'change_request_approved'
    ELSE                  'change_request_rejected'
  END;

  _title := CASE NEW.status
    WHEN 'approved' THEN 'Đề xuất thay đổi nhân sự được duyệt'
    ELSE                  'Đề xuất thay đổi nhân sự bị từ chối'
  END;

  -- Calculate salary totals from changes JSONB (if salary_components exists)
  SELECT COALESCE(SUM((sc->>'old_amount')::numeric), 0),
         COALESCE(SUM((sc->>'new_amount')::numeric), 0)
  INTO   _salary_old, _salary_new
  FROM   jsonb_array_elements(NEW.changes->'salary_components') AS sc
  WHERE  NEW.changes ? 'salary_components';

  -- Build structured body with line breaks
  _body := '<strong>Loại:</strong> ' || _type_label
    || E'\n'
    || '<strong>Hiệu lực:</strong> ' || to_char(NEW.effective_date, 'DD/MM/YYYY');

  -- Append salary summary if applicable
  IF _salary_new > 0 THEN
    _body := _body || E'\n'
      || '<strong>Tổng lương:</strong> '
      || trim(to_char(_salary_old, '999,999,999')) || 'đ → '
      || trim(to_char(_salary_new, '999,999,999')) || 'đ';
  END IF;

  -- Append promotion details
  IF NEW.request_type = 'promotion' THEN
    IF NEW.changes->>'new_position' IS NOT NULL THEN
      _body := _body || E'\n'
        || '<strong>Chức vụ mới:</strong> ' || (NEW.changes->>'new_position');
    END IF;
  END IF;

  -- Append department transfer details
  IF NEW.request_type = 'department_transfer' THEN
    IF NEW.changes->>'new_department_name' IS NOT NULL THEN
      _body := _body || E'\n'
        || '<strong>Phòng ban mới:</strong> ' || (NEW.changes->>'new_department_name');
    END IF;
  END IF;

  -- Append termination details
  IF NEW.request_type = 'termination' THEN
    IF NEW.changes->>'termination_reason' IS NOT NULL THEN
      _body := _body || E'\n'
        || '<strong>Lý do:</strong> ' || (NEW.changes->>'termination_reason');
    END IF;
  END IF;

  -- Append approval note (if any)
  IF NEW.approval_note IS NOT NULL AND NEW.approval_note <> '' THEN
    _body := _body || E'\n'
      || '<strong>Ghi chú:</strong> ' || NEW.approval_note;
  END IF;

  -- Deep link to employee portal → change requests tab → specific card
  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_user_id, _ntype, _title, _body, '#portal/proposals/' || NEW.id::text);

  RETURN NEW;
END;
$$;
