-- Siết quyền đọc dữ liệu lương của role `hr`.
--
-- Bối cảnh: UI đã ẩn lương khỏi HR (`isHrOnly` trong EmployeeDetail/ChangeRequestTab)
-- nhưng RLS vẫn cho `hr` full quyền, nên HR gọi supabase-js trực tiếp là đọc/sửa được hết.
-- Migration này đóng các lỗ đóng được bằng row-level policy.
--
-- ponytail: KHÔNG đóng được ở đây (RLS lọc dòng, không lọc cột):
--   - hr_employees.salary / rate_amount  — policy `hr_employee_read_all` là USING(true),
--     nghĩa là MỌI user đăng nhập đọc được. Muốn bịt phải tách cột ra bảng riêng.
--   - hr_contracts.salary / rate_amount  — HR cần full quyền để soạn hợp đồng.
--   - hr_employee_salary                 — HR cần ghi khi duyệt đơn đề xuất (applyChanges
--     chạy client-side bằng JWT người duyệt). Bịt được nếu chuyển sang RPC SECURITY DEFINER.

-- ══════════════════════════════════════════════════════════
-- 1. pay_payroll_records / pay_payroll_sheets
--    `is_staff()` = admin|hr|ke_toan → HR đọc+sửa+xoá được toàn bộ phiếu lương
--    (net, PIT, BHXH) dù không có app Payroll. Không có consumer nào phía HR.
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS pay_records_staff ON public.pay_payroll_records;
CREATE POLICY pay_records_staff ON public.pay_payroll_records
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

DROP POLICY IF EXISTS pay_sheets_staff ON public.pay_payroll_sheets;
CREATE POLICY pay_sheets_staff ON public.pay_payroll_sheets
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin','ke_toan']));

-- Policy này OR với policy trên, nên cũng phải bỏ is_staff() nếu không HR vẫn SELECT được.
DROP POLICY IF EXISTS pay_sheets_own_read ON public.pay_payroll_sheets;
CREATE POLICY pay_sheets_own_read ON public.pay_payroll_sheets
  FOR SELECT TO authenticated
  USING (
    public.jwt_has_any_role(ARRAY['admin','ke_toan'])
    OR id IN (
      SELECT r.sheet_id FROM public.pay_payroll_records r
      WHERE r.employee_id IN (
        SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════
-- 2. hr_position_history
--    Dòng change_type='salary' có old_value/new_value dạng '12.000.000 VNĐ'.
--    Đây đúng là timeline mà EmployeeDetail đang lọc bằng isHrOnly.
--    Tách FOR ALL thành SELECT (chặn dòng salary với hr) + IUD (vẫn cho hr ghi,
--    để luồng duyệt đơn đề xuất không gãy).
-- ══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS hr_pos_hist_staff_full ON public.hr_position_history;

CREATE POLICY hr_pos_hist_staff_read ON public.hr_position_history
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND (change_type NOT LIKE 'salary%' OR public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  );

CREATE POLICY hr_pos_hist_staff_insert ON public.hr_position_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY hr_pos_hist_staff_update ON public.hr_position_history
  FOR UPDATE TO authenticated
  USING (
    public.is_staff()
    AND (change_type NOT LIKE 'salary%' OR public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  )
  WITH CHECK (public.is_staff());

CREATE POLICY hr_pos_hist_staff_delete ON public.hr_position_history
  FOR DELETE TO authenticated
  USING (
    public.is_staff()
    AND (change_type NOT LIKE 'salary%' OR public.jwt_has_any_role(ARRAY['admin','ke_toan']))
  );
