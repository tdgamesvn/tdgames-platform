-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              text NOT NULL,
  title             text NOT NULL,
  body              text,
  link              text,
  is_read           boolean NOT NULL DEFAULT false,
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS notifications_recipient_created
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread
  ON public.notifications (recipient_user_id)
  WHERE is_read = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ─── DB Triggers that create notifications ──────────────────────────────────

-- 1. Leave status change → notify employee
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
  _body := 'Từ ' || to_char(NEW.start_date, 'DD/MM/YYYY') ||
           ' đến ' || to_char(NEW.end_date, 'DD/MM/YYYY') ||
           CASE WHEN NEW.notes IS NOT NULL THEN ' — ' || NEW.notes ELSE '' END;

  INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
  VALUES (_user_id, _ntype, _title, _body, '#attendance');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_leave_status
  AFTER UPDATE OF status ON public.att_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_status_change();

-- 2. New leave submitted → notify HR/admin
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
      'Từ ' || to_char(NEW.start_date, 'DD/MM/YYYY') ||
      ' đến ' || to_char(NEW.end_date, 'DD/MM/YYYY'),
      '#attendance'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_leave_new
  AFTER INSERT ON public.att_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_new();

-- 3. Payroll paid → notify employee
CREATE OR REPLACE FUNCTION public.notify_payroll_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rec RECORD;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;

  FOR _rec IN
    SELECT e.auth_user_id, e.full_name, pr.net_salary
    FROM pay_payroll_records pr
    JOIN hr_employees e ON e.id = pr.employee_id
    WHERE pr.sheet_id = NEW.id AND e.auth_user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (
      _rec.auth_user_id,
      'payslip_created',
      'Lương tháng đã được chi trả',
      'Lương thực nhận: ' || to_char(_rec.net_salary, 'FM999,999,999') || ' VND',
      '#payroll'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_payroll_paid
  AFTER UPDATE OF status ON public.pay_payroll_sheets
  FOR EACH ROW EXECUTE FUNCTION public.notify_payroll_paid();
