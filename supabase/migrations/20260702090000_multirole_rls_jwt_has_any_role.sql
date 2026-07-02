-- =============================================================
-- Multi-role RLS support
-- Bug: user với secondary_roles (vd ke_toan + hr) được UI cho vào
-- app HR nhưng RLS chỉ check primary role qua get_jwt_role()
-- → insert/update hr_contracts... bị chặn ("Lưu thất bại").
-- Fix gốc: helper jwt_roles()/jwt_has_any_role() đọc cả
-- primary role + secondary_roles[] từ JWT, cập nhật các policy
-- HR đang gate bằng get_jwt_role().
-- =============================================================

-- 1) Trả về toàn bộ roles của user (primary + secondary) từ JWT
CREATE OR REPLACE FUNCTION public.jwt_roles()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT r FROM (
      -- primary role (app_metadata ưu tiên, fallback user_metadata, default member)
      SELECT COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role',
        'member'
      ) AS r
      UNION ALL
      -- secondary_roles (chỉ đọc khi đúng kiểu array)
      SELECT jsonb_array_elements_text(sec.arr)
      FROM (
        SELECT COALESCE(
          CASE WHEN jsonb_typeof(auth.jwt() -> 'app_metadata' -> 'secondary_roles') = 'array'
               THEN auth.jwt() -> 'app_metadata' -> 'secondary_roles' END,
          CASE WHEN jsonb_typeof(auth.jwt() -> 'user_metadata' -> 'secondary_roles') = 'array'
               THEN auth.jwt() -> 'user_metadata' -> 'secondary_roles' END,
          '[]'::jsonb
        ) AS arr
      ) sec
    ) t
    WHERE r IS NOT NULL AND r <> ''
  );
$$;

-- 2) Check user có ít nhất 1 role trong danh sách yêu cầu
CREATE OR REPLACE FUNCTION public.jwt_has_any_role(required text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_roles() && required;
$$;

-- 3) is_staff() nâng cấp: secondary-role aware (giữ nguyên semantics cũ
--    cho user single-role vì jwt_roles() luôn chứa primary role)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.jwt_has_any_role(ARRAY['admin','hr','ke_toan']);
$$;

-- 4) Recreate các policy HR đang gate bằng get_jwt_role()
--    (giữ nguyên danh sách role của từng policy, chỉ đổi cách check)

-- hr_contracts: admin/hr full  ← bug chính
DROP POLICY IF EXISTS hr_contracts_admin_hr_full ON public.hr_contracts;
CREATE POLICY hr_contracts_admin_hr_full ON public.hr_contracts
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));

-- hr_change_requests: admin/hr full
DROP POLICY IF EXISTS cr_admin_hr_full ON public.hr_change_requests;
CREATE POLICY cr_admin_hr_full ON public.hr_change_requests
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));

-- hr_departments: admin/hr full
DROP POLICY IF EXISTS hr_dept_admin_hr_full ON public.hr_departments;
CREATE POLICY hr_dept_admin_hr_full ON public.hr_departments
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));

-- hr_salary_components: admin/hr full
DROP POLICY IF EXISTS hr_salary_comp_admin_hr_full ON public.hr_salary_components;
CREATE POLICY hr_salary_comp_admin_hr_full ON public.hr_salary_components
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr']));

-- hr_employees: admin/hr/ke_toan full (đã có ke_toan, đổi cho nhất quán)
DROP POLICY IF EXISTS hr_admin_hr_full ON public.hr_employees;
CREATE POLICY hr_admin_hr_full ON public.hr_employees
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr','ke_toan']));

-- hr_employee_salary: admin/hr/ke_toan full (đã có ke_toan, đổi cho nhất quán)
DROP POLICY IF EXISTS hr_salary_admin_hr_full ON public.hr_employee_salary;
CREATE POLICY hr_salary_admin_hr_full ON public.hr_employee_salary
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','hr','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','hr','ke_toan']));
