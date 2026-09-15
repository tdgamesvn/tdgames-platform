-- Thông báo đơn nghỉ (in-app + Discord forward) ghi rõ: loại đơn (remote / phép năm / không lương…),
-- giờ + ngày, số ngày/giờ, và lý do — thay vì chỉ "xin nghỉ phép — Từ … đến …".
CREATE OR REPLACE FUNCTION public.notify_leave_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _emp_name text;
  _admin    RECORD;
  _kind     text;
  _title    text;
  _body     text;
  _range    text;
  _amount   text;
BEGIN
  IF NEW.request_type <> 'leave' THEN RETURN NEW; END IF;

  SELECT COALESCE(full_name, 'Nhân viên') INTO _emp_name
  FROM hr_employees WHERE id = NEW.employee_id LIMIT 1;

  _kind := CASE NEW.leave_type
    WHEN 'remote'   THEN '🏠 xin làm remote'
    WHEN 'annual'   THEN '🏖️ xin nghỉ phép năm'
    WHEN 'unpaid'   THEN '💸 xin nghỉ không lương'
    WHEN 'birthday' THEN '🎂 xin nghỉ sinh nhật'
    WHEN 'hieu_hi'  THEN '🎊 xin nghỉ hiếu hỉ'
    ELSE '📅 xin nghỉ phép'
  END;
  _title := _emp_name || ' ' || _kind;

  -- Khoảng thời gian: có giờ thì ghi giờ, không thì chỉ ngày
  IF NEW.time_from IS NOT NULL AND NEW.time_to IS NOT NULL THEN
    _range := 'Từ ' || to_char(NEW.time_from, 'HH24:MI') || ' ' || to_char(NEW.date_from, 'DD/MM/YYYY')
           || ' đến ' || to_char(NEW.time_to, 'HH24:MI') || ' ' || to_char(NEW.date_to, 'DD/MM/YYYY');
  ELSIF NEW.date_from = NEW.date_to THEN
    _range := 'Ngày ' || to_char(NEW.date_from, 'DD/MM/YYYY');
  ELSE
    _range := 'Từ ' || to_char(NEW.date_from, 'DD/MM/YYYY') || ' đến ' || to_char(NEW.date_to, 'DD/MM/YYYY');
  END IF;

  _amount := CASE
    WHEN NEW.leave_hours IS NOT NULL AND NEW.leave_hours > 0 THEN ' (' || trim(to_char(NEW.leave_hours, 'FM999990.##')) || ' giờ)'
    WHEN NEW.leave_days  IS NOT NULL AND NEW.leave_days  > 0 THEN ' (' || trim(to_char(NEW.leave_days,  'FM999990.##')) || ' ngày)'
    ELSE ''
  END;

  _body := '🕐 ' || _range || _amount || E'\n'
        || '📝 Lý do: ' || COALESCE(NULLIF(trim(NEW.reason), ''), '(không ghi)');

  FOR _admin IN
    SELECT u.id FROM auth.users u
    WHERE (u.raw_user_meta_data->>'role') IN ('admin', 'hr')
  LOOP
    INSERT INTO public.notifications (recipient_user_id, type, title, body, link)
    VALUES (_admin.id, 'leave_new', _title, _body, '#attendance');
  END LOOP;

  RETURN NEW;
END;
$$;
