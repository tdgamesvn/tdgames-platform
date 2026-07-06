-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — Chốt quy tắc chính thức (sếp, 2026-07-06):
--   "Mỗi tháng khi lên chính thức thì cộng 1 ngày nghỉ phép, cộng dồn.
--    Hết năm không dùng hết thì bị reset (KHÔNG carry-over sang năm sau)."
--
-- Root cause đã fix:
--   1. Cron refresh_leave_balances() ghi vào quarter=1 (annual), nhưng
--      frontend coi quarter=1 là "carry-over năm trước" và tự zero nó
--      sau Q1 → số dư tự về 0. Fix: cron + trigger đều ghi quarter=0.
--   2. Trigger auto_create_leave_balance() dùng công thức 0.5 ngày/tháng
--      lẻ (front-loaded cả năm), khác với count_official_months_in_year()
--      (chỉ tính tháng ĐÃ hoàn thành tính đến hôm nay). Fix: dùng chung
--      1 công thức duy nhất — count_official_months_in_year.
--   3. Trigger chỉ lắng nghe UPDATE OF probation_end (bỏ sót khi HR chỉ
--      sửa official_date). Fix: thêm official_date vào trigger.
--   4. ON CONFLICT DO NOTHING khiến balance đứng yên mãi mãi dù ngày
--      chính thức đổi sau đó. Fix: DO UPDATE SET accrued_days = ...
--   5. Không còn carry-over → bỏ cron expire-leave-balances-q1.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Trigger: tự tạo/cập nhật balance quarter=0 khi hr_employees đổi ──
CREATE OR REPLACE FUNCTION public.auto_create_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eff_date     DATE;
  balance_year INT;
  accrued_val  NUMERIC;
BEGIN
  IF NEW.type != 'fulltime' OR NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  eff_date := COALESCE(NEW.official_date, NEW.probation_end + 1);
  IF eff_date IS NULL THEN
    RETURN NEW;
  END IF;

  balance_year := EXTRACT(YEAR FROM eff_date)::INT;
  accrued_val  := LEAST(count_official_months_in_year(eff_date, balance_year, CURRENT_DATE), 12);

  INSERT INTO leave_balances (employee_id, year, quarter, accrued_days, used_days)
  VALUES (NEW.id, balance_year, 0, accrued_val, 0)
  ON CONFLICT (employee_id, year, quarter)
  DO UPDATE SET accrued_days = EXCLUDED.accrued_days;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_leave_balance ON hr_employees;

CREATE TRIGGER trg_auto_leave_balance
  AFTER INSERT OR UPDATE OF probation_end, official_date, type, status
  ON hr_employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_leave_balance();

-- ── 2. Cron hàng tháng: ghi vào quarter=0 (không phải quarter=1) ───────
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
      AND COALESCE(official_date, probation_end + 1) <= as_of
  LOOP
    earned := LEAST(public.count_official_months_in_year(emp.effective_date, target_year, as_of), 12);

    INSERT INTO public.leave_balances (employee_id, year, quarter, accrued_days, used_days)
    VALUES (emp.id, target_year, 0, earned, 0)
    ON CONFLICT (employee_id, year, quarter)
    DO UPDATE SET accrued_days = EXCLUDED.accrued_days;
  END LOOP;
END;
$function$;

-- ── 3. Bỏ cron carry-over (không còn khái niệm carry-over sang năm sau) ──
DO $$
BEGIN
  PERFORM cron.unschedule('expire-leave-balances-q1');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job không tồn tại thì bỏ qua
END $$;

-- ── 4. leave_balance_summary: đọc quarter=0, bỏ grace period Q1 năm sau ──
CREATE OR REPLACE VIEW public.leave_balance_summary AS
SELECT
  e.id AS employee_id,
  e.full_name,
  lb.year,
  lb.accrued_days,
  lb.used_days,
  lb.expired_days,
  GREATEST(0::numeric, lb.accrued_days - lb.used_days - lb.expired_days) AS remaining_days,
  CASE
    WHEN lb.expired_days > 0 THEN 'hết hạn'
    WHEN lb.accrued_days = 0 THEN 'chưa đủ tháng'
    WHEN lb.year < EXTRACT(YEAR FROM CURRENT_DATE)::int THEN 'hết hạn'
    ELSE 'hợp lệ'
  END AS balance_status,
  make_date(lb.year, 12, 31) AS expires_on
FROM leave_balances lb
JOIN hr_employees e ON e.id = lb.employee_id
WHERE lb.quarter = 0
ORDER BY e.full_name, lb.year DESC;

-- ── 5. Backfill: tính lại đúng quarter=0 cho toàn bộ FT/active hiện có ──
SELECT public.refresh_leave_balances(2026);
