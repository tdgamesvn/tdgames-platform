-- Tax Portal: view nhân sự giới hạn cột cho role ke_toan_thue.
-- Đã apply lên remote qua MCP apply_migration (remote version 20260708072253,
-- name: tax_portal_hr_view) — file này đưa DDL về repo để giữ lịch sử schema.
--
-- Thiết kế: view KHÔNG bật security_invoker — chạy quyền owner (postgres),
-- bypass RLS của hr_employees; kiểm soát truy cập bằng chính WHERE clause
-- (jwt_has_any_role). Chỉ expose các cột phục vụ BHXH/TNCN — không có lương,
-- tài khoản ngân hàng, ghi chú nội bộ.

CREATE OR REPLACE VIEW public.hr_employees_tax_view AS
SELECT
  id,
  employee_code,
  full_name,
  date_of_birth,
  gender,
  id_number,
  id_issue_date,
  id_issue_place,
  address,
  insurance_number,
  tax_code,
  start_date,
  official_date,
  "position",
  department_id,
  status,
  id_card_front_url,
  id_card_back_url
FROM public.hr_employees
WHERE public.jwt_has_any_role(ARRAY['ke_toan_thue'::text]);
