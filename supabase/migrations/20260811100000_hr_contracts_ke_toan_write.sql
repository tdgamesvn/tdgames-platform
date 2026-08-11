-- Kế toán không xuất được hợp đồng: migration 20260807110000 siết hr_contracts về
-- ALL cho admin, ke_toan chỉ còn SELECT. Nhưng UI vẫn cho ke_toan bấm "Xuất hợp đồng"
-- (gate là isHrOnly = hr && !admin) → saveContract() INSERT bị RLS chặn.
-- Kéo theo updateContract (gắn PDF đã ký) và deleteContract cũng fail.
--
-- Ke_toan vốn đã ALL trên hr_employee_salary (lương là nghiệp vụ của họ), nên mở
-- nguyên bảng hợp đồng cho ke_toan không hở thêm dữ liệu gì. HR vẫn bị cắt như cũ.

DROP POLICY IF EXISTS hr_contracts_admin_full ON public.hr_contracts;
DROP POLICY IF EXISTS hr_contracts_ke_toan_read ON public.hr_contracts;

CREATE POLICY hr_contracts_admin_ke_toan_full ON public.hr_contracts
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin', 'ke_toan']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin', 'ke_toan']));

-- Giữ nguyên hr_contracts_self_read (nhân viên xem hợp đồng của chính mình).
