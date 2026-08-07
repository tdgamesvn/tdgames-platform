-- Cắt quyền `hr` trên hr_contracts. Sếp chốt: HR không quản lý hợp đồng lao động.
--
-- Đóng luôn 2 lỗ:
--   #1 hr_contracts.salary / rate_amount — HR đọc được lương qua hợp đồng dù UI đã ẩn
--      lương ở tab Thông tin (isHrOnly). RLS không lọc cột được, nhưng ở đây không cần:
--      HR không có nghiệp vụ nào trên bảng này nữa → cắt nguyên bảng.
--   #2 hr_contracts.file_url — link R2 public, HR đọc row là có URL PDF hợp đồng.
--      Không đọc được row thì không có URL. R2 vẫn là public bucket (bảo mật bằng
--      URL khó đoán) — chấp nhận, không đụng tới theo quyết định của sếp.
--
-- Cắt cả bảng chứ không chỉ contract_type IN ('labor','service'): dữ liệu thực tế có
-- 2/3 hợp đồng `nda` mang rate_amount, nên lọc theo loại vẫn hở.

DROP POLICY IF EXISTS hr_contracts_admin_hr_full ON public.hr_contracts;
CREATE POLICY hr_contracts_admin_full ON public.hr_contracts
  FOR ALL TO authenticated
  USING (public.jwt_has_any_role(ARRAY['admin']))
  WITH CHECK (public.jwt_has_any_role(ARRAY['admin']));

-- Giữ nguyên: hr_contracts_ke_toan_read (ke_toan SELECT), hr_contracts_self_read
-- (nhân viên xem hợp đồng của chính mình — HR cũng dùng đường này cho HĐ bản thân).

-- ponytail: hardDeleteEmployee() xoá hr_contracts theo employee_id — admin-only nên
-- vẫn chạy. HR không có nút đó.
