-- Tax Portal: hr_employees_tax_view chưa lọc is_hidden — nhân sự test/nháp
-- đã đánh dấu is_hidden=true (ẩn khỏi Company Hub) vẫn lọt vào đây vì view
-- chạy quyền owner (bypass RLS) và không check cờ này. Thêm điều kiện.

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
WHERE public.jwt_has_any_role(ARRAY['ke_toan_thue'::text])
  AND entity = 'TD GAMES'
  AND is_hidden = false;
