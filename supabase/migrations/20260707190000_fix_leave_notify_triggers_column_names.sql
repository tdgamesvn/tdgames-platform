-- Fix: att_requests thực tế dùng date_from/date_to/reviewer_note, không phải start_date/end_date/notes
-- Trigger cũ (20260520033918_create_notifications_system.sql) tham chiếu sai tên cột
-- => mọi INSERT/UPDATE status vào att_requests đều lỗi "record new has no field start_date"

CREATE OR REPLACE FUNCTION public.notify_leave_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id uuid;
  _ntype   text;
  _title   text;
  _body    text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.request_type <> 'leave' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  SELECT auth_user_id INTO _user_id
  FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;
  IF _user_id IS NULL THEN RETURN NEW; END IF;

  _ntype := CASE NEW.status WHEN 'approved' THEN 'leave_approved' ELSE 'leave_rejected' END;
  _title := CASE NEW.status
    WHEN 'approved' THEN 'Đơn nghỉ phép được duyệt'
    ELSE 'Đơn nghỉ phép bị từ chối'
  END;
  _body := 'Từ ' || to_char(NEW.date_from, 'DD/MM/YYYY') ||
           ' đến ' || to_char(NEW.date_to, 'DD/MM/YYYY') ||
           CASE WHEN NEW.reviewer_note IS NOT NULL THEN ' — ' || NEW.reviewer_note ELSE '' END;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_user_id, _ntype, _title, _body, '#attendance');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_leave_new()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp_name text;
  _admin    RECORD;
BEGIN
  IF NEW.request_type <> 'leave' THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, 'Nhân viên') INTO _emp_name
  FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;

  FOR _admin IN
    SELECT u.id FROM auth.users u
    WHERE (u.raw_user_meta_data->>'role') IN ('admin', 'hr')
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (
      _admin.id,
      'leave_new',
      _emp_name || ' xin nghỉ phép',
      'Từ ' || to_char(NEW.date_from, 'DD/MM/YYYY') ||
      ' đến ' || to_char(NEW.date_to, 'DD/MM/YYYY'),
      '#attendance'
    );
  END LOOP;

  RETURN NEW;
END;
$$;
