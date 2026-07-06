-- Fix: refresh_leave_balances() bỏ sót nhân viên fulltime/active đã qua thử việc
-- nhưng chưa được set official_date (chỉ có probation_end).
-- Quyết định (sếp, 2026-07-06):
--   1. Ngày gốc tính phép: official_date, fallback probation_end + 1 nếu null
--   2. Công thức tháng lẻ: giữ nguyên logic tháng tròn hiện tại (không thêm luật 0.5 ngày)
CREATE OR REPLACE FUNCTION public.refresh_leave_balances(target_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp record;
  earned int;
  as_of date := CURRENT_DATE;
  effective_date date;
BEGIN
  FOR emp IN
    SELECT id, COALESCE(official_date, probation_end + 1) AS effective_date
    FROM public.hr_employees
    WHERE type = 'fulltime'
      AND status = 'active'
      AND COALESCE(official_date, probation_end + 1) IS NOT NULL
      AND COALESCE(official_date, probation_end + 1) <= as_of
  LOOP
    earned := LEAST(public.count_official_months_in_year(emp.effective_date, target_year, as_of), 12);

    INSERT INTO public.leave_balances (employee_id, year, quarter, accrued_days, used_days)
    VALUES (emp.id, target_year, 1, earned, 0)
    ON CONFLICT (employee_id, year, quarter)
    DO UPDATE SET accrued_days = EXCLUDED.accrued_days;
  END LOOP;
END;
$function$;
