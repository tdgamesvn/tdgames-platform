-- Lỗ #4 (phần còn lại): bỏ cột rate cache trên hr_employees.
-- Nguồn thật là hr_employee_rate (20260809110000), RLS admin/ke_toan — HR không đọc được.
-- CHỈ CHẠY SAU KHI commit 2b2c16c đã lên prod (code không còn đọc/ghi 3 cột này).
-- Sai thứ tự = lặp sự cố 07/08 (migration đi trước code → prod hỏng). DROP không rollback được.
alter table public.hr_employees drop column if exists rate_amount;
alter table public.hr_employees drop column if exists rate_currency;
alter table public.hr_employees drop column if exists rate_type;
