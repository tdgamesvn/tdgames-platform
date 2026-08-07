-- Đóng nốt lỗ chí mạng: role `hr` đang có FOR ALL trên hr_employee_salary.
-- Che UI bao nhiêu cũng vô nghĩa khi HR mở devtools gọi
-- supabase.from('hr_employee_salary').select('*') là đọc/sửa/xoá được hết.
--
-- Vướng mắc: HR *có* duyệt đơn đề xuất (ChangeRequestTab:125 gồm 'hr'), và
-- applyChanges chạy client-side bằng JWT người duyệt → HR cần GHI lương.
-- Không tách được thành "ghi mà không đọc" vì rotateSalary phải SELECT dòng
-- đang hiệu lực trước khi đóng nó; RLS ẩn dòng thì UPDATE cũng không thấy.
-- → Chuyển toàn bộ thao tác rotate vào 1 RPC SECURITY DEFINER, rồi cắt sạch
--   quyền bảng của HR.

-- ══════════════════════════════════════════════════════════
-- 1. RPC thay cho luồng rotate client-side
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hr_rotate_salary(
  p_employee_id   uuid,
  p_component_id  uuid,
  p_amount        numeric,
  p_effective_from date,
  p_note          text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- SECURITY DEFINER bỏ qua RLS → phải tự gác cổng.
  IF NOT public.jwt_has_any_role(ARRAY['admin', 'hr', 'ke_toan']) THEN
    RAISE EXCEPTION 'forbidden: hr_rotate_salary';
  END IF;

  -- Đóng dòng đang hiệu lực của component này
  UPDATE public.hr_employee_salary
     SET effective_to = p_effective_from
   WHERE employee_id = p_employee_id
     AND component_id = p_component_id
     AND effective_to IS NULL;

  -- Mở dòng mới (amount = 0 nghĩa là bỏ khoản này)
  IF p_amount > 0 THEN
    INSERT INTO public.hr_employee_salary
      (employee_id, component_id, amount, note, effective_from, effective_to)
    VALUES
      (p_employee_id, p_component_id, p_amount, p_note, p_effective_from, NULL);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.hr_rotate_salary(uuid, uuid, numeric, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_rotate_salary(uuid, uuid, numeric, date, text) TO authenticated;

-- ══════════════════════════════════════════════════════════
-- 2. Cắt quyền bảng của `hr`
--    Còn lại: admin/ke_toan full, và hr_salary_self_read cho NV xem lương
--    của chính mình (HR xem lương bản thân là hợp lệ).
-- ══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS hr_salary_admin_hr_full ON public.hr_employee_salary;
CREATE POLICY hr_salary_admin_full ON public.hr_employee_salary
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin', 'ke_toan']));

-- ponytail: hr_employees.salary / rate_amount VẪN hở — policy hr_employee_read_all
-- là USING(true), mọi user đăng nhập đọc được. RLS lọc dòng chứ không lọc cột,
-- nên chỉ bịt được bằng cách tách 2 cột đó ra bảng riêng (đụng payroll,
-- accounting, dashboard). Chưa làm — xem DECISIONS.md.
