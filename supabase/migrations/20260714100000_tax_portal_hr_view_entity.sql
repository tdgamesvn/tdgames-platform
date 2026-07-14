-- Tax Portal: hr_employees_tax_view đang trả về nhân sự cả 2 sổ (TD GAMES +
-- TD CONSULTING). Sếp yêu cầu tax portal chỉ xem dữ liệu TD GAMES. View chạy
-- quyền owner (bypass RLS), nên phải lọc entity ngay trong WHERE clause.

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
  AND entity = 'TD GAMES';
