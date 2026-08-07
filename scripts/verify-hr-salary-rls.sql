-- Check: role `hr` không đọc được dữ liệu lương, nhưng vẫn duyệt được đơn (RPC).
-- Chạy qua Supabase SQL editor / MCP execute_sql. Kỳ vọng: 4 dòng đầu = 0, ke_toan > 0,
-- rpc gọi được với hr và raise 'forbidden' với member.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","app_metadata":{"role":"hr"}}';
select
  (select count(*) from public.hr_employee_salary)                                  as hr_salary_rows,      -- expect 0
  (select count(*) from public.hr_position_history where change_type like 'salary%') as hr_salary_history,   -- expect 0
  (select count(*) from public.pay_payroll_records)                                  as hr_payroll_records,  -- expect 0
  (select count(*) from public.pay_payroll_sheets)                                   as hr_payroll_sheets,   -- expect 0
  (select count(*) from public.hr_position_history)                                  as hr_pos_hist_nonsalary; -- expect > 0
rollback;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","app_metadata":{"role":"ke_toan"}}';
select
  (select count(*) from public.hr_employee_salary)  as ketoan_salary_rows,     -- expect > 0
  (select count(*) from public.pay_payroll_records) as ketoan_payroll_records; -- expect > 0
rollback;

-- member gọi RPC phải văng 'forbidden: hr_rotate_salary'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","app_metadata":{"role":"member"}}';
select public.hr_rotate_salary(
  (select employee_id from public.hr_employee_salary limit 1),
  (select component_id from public.hr_employee_salary limit 1),
  1, current_date, 'probe');
rollback;
