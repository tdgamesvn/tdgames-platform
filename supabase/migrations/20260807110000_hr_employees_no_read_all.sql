-- Lỗ #3: policy `hr_employee_read_all` là USING(true) → MỌI user đăng nhập
-- (kể cả member/freelancer) SELECT được `hr_employees.salary` / `rate_amount`
-- của toàn công ty. RLS lọc DÒNG chứ không lọc CỘT, nên cách bịt là:
--   1. cắt quyền đọc-tất-cả, chỉ còn đọc dòng của chính mình
--   2. danh bạ nhân viên (Portal) chuyển sang view không có cột lương
-- Staff vẫn đọc đủ qua policy sẵn có: hr_admin_hr_full (admin/hr/ke_toan)
-- và hr_ke_toan_read.

drop policy if exists "hr_employee_read_all" on public.hr_employees;

create policy "hr_employee_self_read" on public.hr_employees
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

-- View danh bạ: chỉ cột public, KHÔNG có salary/rate_amount.
-- security_invoker = off (mặc định) → chạy quyền owner, bỏ qua RLS bảng gốc.
create or replace view public.hr_employee_directory
with (security_invoker = off) as
select
  id, full_name, email, work_email, phone, position, avatar_url,
  status, type, department_id, date_of_birth, address
from public.hr_employees
where status = 'active'
  and type in ('fulltime', 'parttime')
  and is_hidden is not true;

revoke all on public.hr_employee_directory from anon;
grant select on public.hr_employee_directory to authenticated;
