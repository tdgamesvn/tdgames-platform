-- Bug: refresh_leave_balances() chỉ UPDATE người đã chính thức
-- (effective_date <= today) → NV chưa tới ngày chính thức giữ nguyên
-- accrued_days cũ (VD Nguyễn Tiến Đạt: 4.5 ngày sót từ công thức
-- 0.5/tháng trước migration 20260707170000). Bỏ điều kiện để mọi
-- FT/active đều được ghi lại đúng, kể cả về 0.
CREATE OR REPLACE FUNCTION public.refresh_leave_balances(target_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  emp record;
  earned int;
  as_of date := CURRENT_DATE;
BEGIN
  FOR emp IN
    SELECT id, COALESCE(official_date, probation_end + 1) AS effective_date
    FROM public.hr_employees
    WHERE type = 'fulltime'
      AND status = 'active'
      AND COALESCE(official_date, probation_end + 1) IS NOT NULL
  LOOP
    earned := LEAST(public.count_official_months_in_year(emp.effective_date, target_year, as_of), 12);

    INSERT INTO public.leave_balances (employee_id, year, quarter, accrued_days, used_days)
    VALUES (emp.id, target_year, 0, earned, 0)
    ON CONFLICT (employee_id, year, quarter)
    DO UPDATE SET accrued_days = EXCLUDED.accrued_days;
  END LOOP;
END;
$function$;

SELECT public.refresh_leave_balances(2026);
