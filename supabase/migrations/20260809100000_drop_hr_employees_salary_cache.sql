-- Lỗ #3 (phần còn lại): `hr_employees.salary` / `salary_currency`.
--
-- RLS lọc DÒNG chứ không lọc CỘT. Migration 20260807120000 đã cắt policy
-- đọc-tất-cả cho member/freelancer, nhưng policy `hr_admin_hr_full` vẫn cho
-- role `hr` SELECT toàn bảng → HR gọi supabase-js là đọc được cột salary của
-- cả công ty, dù UI đã ẩn.
--
-- Cột này chỉ là CACHE. Nguồn thật là `hr_employee_salary` — đã khoá khỏi HR
-- ở 20260807100000 (RPC hr_rotate_salary SECURITY DEFINER + policy admin/ke_toan).
-- Payroll đọc thẳng hr_employee_salary (payrollService.ts:383), không đụng cột này.
-- Edge function platform-data / billing-report select cột tường minh, không có salary.
--
-- ponytail: bỏ cache thay vì tách bảng — cache của một bảng đã khoá thì không
-- có lý do tồn tại. Client đã bỏ hết read/write ở commit cùng bộ.
--
-- ⚠️ Không rollback được. Backup trước khi chạy trên prod:
--   copy (select id, salary, salary_currency from public.hr_employees) to stdout csv;

alter table public.hr_employees drop column if exists salary;
alter table public.hr_employees drop column if exists salary_currency;
