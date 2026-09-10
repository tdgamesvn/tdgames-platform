-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — carry-over sang Q1 năm sau (sếp, 2026-09-10):
--
--   Cũ (20260707170000): hết năm không dùng hết → reset về 0.
--   Mới: phép thừa cuối năm N → dùng được đến hết 31/3 năm N+1,
--        qua 1/4 chưa dùng thì xoá.
--
--   Cách làm: tái dùng dòng (year = N+1, quarter = 1) mà trigger
--   handle_leave_request_status_change ĐÃ hỗ trợ (trừ carry-over trước,
--   rồi mới trừ quarter=0). Cron refresh hàng ngày:
--     - Tháng 1–3: upsert quarter=1 = số dư còn lại của năm trước.
--     - Từ 1/4:    expired_days = accrued - used trên dòng quarter=1.
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_leave_balances(target_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  emp record;
  earned int;
  prev_left numeric;
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

    -- ── Carry-over Q1: số dư năm trước → dòng quarter=1 của năm nay ──
    IF as_of >= make_date(target_year, 1, 1) AND as_of <= make_date(target_year, 3, 31) THEN
      SELECT GREATEST(0, accrued_days - used_days - COALESCE(expired_days, 0))
      INTO prev_left
      FROM public.leave_balances
      WHERE employee_id = emp.id AND year = target_year - 1 AND quarter = 0;

      IF prev_left IS NOT NULL THEN
        INSERT INTO public.leave_balances (employee_id, year, quarter, accrued_days, used_days)
        VALUES (emp.id, target_year, 1, prev_left, 0)
        ON CONFLICT (employee_id, year, quarter)
        DO UPDATE SET accrued_days = EXCLUDED.accrued_days;
      END IF;
    ELSIF as_of > make_date(target_year, 3, 31) THEN
      -- ponytail: idempotent, chạy lại hàng ngày cũng ra cùng kết quả
      UPDATE public.leave_balances
      SET expired_days = GREATEST(0, accrued_days - used_days)
      WHERE employee_id = emp.id AND year = target_year AND quarter = 1;
    END IF;
  END LOOP;
END;
$function$;

-- Khoá cron cũ (không tồn tại thì bỏ qua) — logic đã nằm trong refresh hàng ngày.
DO $$ BEGIN PERFORM cron.unschedule('expire-leave-balances-q1'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- View: cộng carry-over vào số còn lại, hạn = 31/3 năm sau
DROP VIEW IF EXISTS public.leave_balance_summary;
CREATE VIEW public.leave_balance_summary AS
SELECT
  e.id AS employee_id,
  e.full_name,
  lb.year,
  lb.accrued_days,
  lb.used_days,
  lb.expired_days,
  COALESCE(co.accrued_days - co.used_days - COALESCE(co.expired_days, 0), 0) AS carried_days,
  GREATEST(0::numeric, lb.accrued_days - lb.used_days - lb.expired_days)
    + GREATEST(0::numeric, COALESCE(co.accrued_days - co.used_days - COALESCE(co.expired_days, 0), 0)) AS remaining_days,
  CASE
    WHEN lb.expired_days > 0 THEN 'hết hạn'
    WHEN lb.accrued_days = 0 THEN 'chưa đủ tháng'
    WHEN CURRENT_DATE > make_date(lb.year + 1, 3, 31) THEN 'hết hạn'
    ELSE 'hợp lệ'
  END AS balance_status,
  make_date(lb.year + 1, 3, 31) AS expires_on
FROM leave_balances lb
JOIN hr_employees e ON e.id = lb.employee_id
LEFT JOIN leave_balances co ON co.employee_id = lb.employee_id AND co.year = lb.year AND co.quarter = 1
WHERE lb.quarter = 0
ORDER BY e.full_name, lb.year DESC;

SELECT public.refresh_leave_balances();
