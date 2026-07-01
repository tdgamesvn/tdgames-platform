-- ============================================================
-- Migration: Fix ke_toan RLS on hr_employees + hr_employee_salary
--            + Update get_jwt_role() to prefer app_metadata
-- ============================================================

-- 1. Update get_jwt_role() to check app_metadata first (consistent with session 8 fix),
--    fallback to user_metadata for older users
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    'member'
  );
$$;

-- 2. Fix hr_employees: add ke_toan to the ALL policy
DROP POLICY IF EXISTS hr_admin_hr_full ON hr_employees;
CREATE POLICY hr_admin_hr_full ON hr_employees
  FOR ALL
  USING (get_jwt_role() = ANY (ARRAY['admin', 'hr', 'ke_toan']))
  WITH CHECK (get_jwt_role() = ANY (ARRAY['admin', 'hr', 'ke_toan']));

-- 3. Fix hr_employee_salary: add ke_toan to the ALL policy
DROP POLICY IF EXISTS hr_salary_admin_hr_full ON hr_employee_salary;
CREATE POLICY hr_salary_admin_hr_full ON hr_employee_salary
  FOR ALL
  USING (get_jwt_role() = ANY (ARRAY['admin', 'hr', 'ke_toan']))
  WITH CHECK (get_jwt_role() = ANY (ARRAY['admin', 'hr', 'ke_toan']));
