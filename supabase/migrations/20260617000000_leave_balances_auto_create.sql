-- ══════════════════════════════════════════════════════════════════
-- Leave Balances — Fix quarter constraint + auto-create trigger + backfill
-- ══════════════════════════════════════════════════════════════════
-- Root cause: DB had CHECK (quarter >= 1) but TypeScript uses quarter=0
-- for the main yearly balance. This caused ensureBalancesForYear() to
-- silently fail on INSERT, leaving all FT employees with no yearly balance.
--
-- This migration:
--   1. Extends quarter constraint to allow 0 (yearly accrual sentinel)
--   2. Adds calculate_yearly_accrual_days() SQL helper (mirrors TS logic)
--   3. Adds trigger: auto-create quarter=0 record when probation_end is set
--   4. Backfills correct quarter=0 records for ALL FT employees
-- ══════════════════════════════════════════════════════════════════

-- ── 1. Fix quarter constraint: allow 0 (yearly) through 4 ─────────
ALTER TABLE leave_balances
  DROP CONSTRAINT IF EXISTS leave_balances_quarter_check;

ALTER TABLE leave_balances
  ADD CONSTRAINT leave_balances_quarter_check
  CHECK (quarter >= 0 AND quarter <= 4);

-- ── 2. Helper: mirrors calculateYearlyAccrual() in leaveService.ts ─
--   Rules:
--   - p_official_date = probation_end date
--   - 1 full month before p_official_date = 1 day
--   - Partial start month: day-of-month ≤ 15 → 0.5 days
CREATE OR REPLACE FUNCTION calculate_yearly_accrual_days(
  p_official_date DATE,
  p_year          INT
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  accrued     NUMERIC := 0;
  m           INT;
  month_start DATE;
  month_end   DATE;
BEGIN
  FOR m IN 1..12 LOOP
    month_start := make_date(p_year, m, 1);
    month_end   := (make_date(p_year, m, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

    IF p_official_date <= month_start THEN
      -- Employee was official before this month started → full day
      accrued := accrued + 1;
    ELSIF p_official_date <= month_end THEN
      -- Partial month: started on/before the 15th = 0.5 days
      IF EXTRACT(DAY FROM p_official_date) <= 15 THEN
        accrued := accrued + 0.5;
      END IF;
    END IF;
  END LOOP;

  RETURN accrued;
END;
$$;

-- ── 3. Trigger: auto-create balance when probation_end is set ──────
CREATE OR REPLACE FUNCTION auto_create_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER           -- bypasses RLS so INSERT always succeeds
SET search_path = public
AS $$
DECLARE
  balance_year INT;
  accrued_val  NUMERIC;
BEGIN
  -- Only fulltime + active employees qualify for annual leave
  IF NEW.type != 'fulltime' OR NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- probation_end must be set (= official start date for accrual)
  IF NEW.probation_end IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: only process when probation_end actually changes
  IF TG_OP = 'UPDATE' AND OLD.probation_end IS NOT DISTINCT FROM NEW.probation_end THEN
    RETURN NEW;
  END IF;

  balance_year := EXTRACT(YEAR FROM NEW.probation_end)::INT;
  accrued_val  := calculate_yearly_accrual_days(NEW.probation_end, balance_year);

  IF accrued_val > 0 THEN
    INSERT INTO leave_balances (employee_id, year, quarter, accrued_days, used_days)
    VALUES (NEW.id, balance_year, 0, accrued_val, 0)
    ON CONFLICT (employee_id, year, quarter) DO NOTHING;
    -- DO NOTHING: preserves any record already set via the app/manually
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_leave_balance ON hr_employees;

CREATE TRIGGER trg_auto_leave_balance
  AFTER INSERT OR UPDATE OF probation_end, type, status
  ON hr_employees
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_leave_balance();

-- ── 4. Backfill: insert correct quarter=0 records for all FT ──────
-- Skips employees who already have a quarter=0 record (DO NOTHING).
-- Existing quarter=1 records (manual placeholders) are left untouched.
INSERT INTO leave_balances (employee_id, year, quarter, accrued_days, used_days)
SELECT e.id,
       2026,
       0,
       calculate_yearly_accrual_days(e.probation_end, 2026),
       0
FROM hr_employees e
WHERE e.type        = 'fulltime'
  AND e.status      = 'active'
  AND e.probation_end IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM leave_balances lb
    WHERE lb.employee_id = e.id
      AND lb.year        = 2026
      AND lb.quarter     = 0
  );
