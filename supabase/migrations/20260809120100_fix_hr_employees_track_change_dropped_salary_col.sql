-- hr_employees.salary đã dời sang hr_employee_salary nhưng trigger còn tham chiếu NEW.salary
-- => MỌI UPDATE trên hr_employees raise 42703 (record "new" has no field "salary").
-- Lịch sử lương giờ do hr_rotate_salary ghi, nên bỏ hẳn nhánh salary.
CREATE OR REPLACE FUNCTION public.fn_hr_employees_track_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth, extensions, net, cron, pg_temp
AS $fn$
BEGIN
  IF NEW.official_date IS DISTINCT FROM OLD.official_date THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'official_date', COALESCE(OLD.official_date::text,''), COALESCE(NEW.official_date::text,''),
            COALESCE(NEW.official_date, CURRENT_DATE), 'auto: official_date changed');
  END IF;
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'type', COALESCE(OLD.type,''), COALESCE(NEW.type,''), CURRENT_DATE, 'auto: type changed');
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'status', COALESCE(OLD.status,''), COALESCE(NEW.status,''), CURRENT_DATE, 'auto: status changed');
  END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'department', COALESCE(OLD.department_id::text,''), COALESCE(NEW.department_id::text,''), CURRENT_DATE, 'auto: department changed');
  END IF;
  IF NEW.position IS DISTINCT FROM OLD.position THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'position', COALESCE(OLD.position,''), COALESCE(NEW.position,''), CURRENT_DATE, 'auto: position changed');
  END IF;
  IF NEW.level IS DISTINCT FROM OLD.level THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'level', COALESCE(OLD.level,''), COALESCE(NEW.level,''), CURRENT_DATE, 'auto: level changed');
  END IF;
  IF NEW.probation_end IS DISTINCT FROM OLD.probation_end THEN
    INSERT INTO public.hr_position_history(employee_id, change_type, old_value, new_value, effective_date, reason)
    VALUES (NEW.id, 'probation_end', COALESCE(OLD.probation_end::text,''), COALESCE(NEW.probation_end::text,''),
            COALESCE(NEW.probation_end, CURRENT_DATE), 'auto: probation_end changed');
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_hr_employees_track_change() FROM PUBLIC, anon, authenticated;
