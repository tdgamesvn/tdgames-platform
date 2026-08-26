-- Fix 42P17 "infinite recursion detected in policy for relation hr_employees".
--
-- Policy cũ lọc bằng subquery trên CHÍNH hr_employees:
--   id IN (SELECT id FROM hr_employees WHERE auth_user_id = auth.uid())
-- Subquery đó lại bị RLS của hr_employees áp lên ⇒ policy gọi lại chính nó ⇒ đệ quy.
-- Postgres đánh giá mọi permissive policy nên admin/HR cũng chết theo, không riêng nhân viên.
--
-- Cột auth_user_id nằm ngay trên hàng đang xét, so thẳng là xong — đúng cách
-- policy hr_employee_self_read cạnh đó vẫn làm. Ngữ nghĩa không đổi.
DROP POLICY IF EXISTS hr_employee_self_update ON public.hr_employees;

CREATE POLICY hr_employee_self_update ON public.hr_employees
  FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- ponytail: policy này vẫn cho nhân viên tự sửa MỌI cột hàng của mình (gồm base_salary,
-- position, status). Đó là lỗ hổng có sẵn từ trước, không phải do lần sửa này — chặn cột
-- nhạy cảm thì phải tách quyền theo cột hoặc dựng trigger, làm khi sếp chốt danh sách cột.
