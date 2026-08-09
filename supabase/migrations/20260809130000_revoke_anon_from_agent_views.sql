-- LỖ NGHIÊM TRỌNG (phát hiện 2026-08-09 khi audit đường vòng đọc lương): các view v_agent_*
-- có owner postgres và KHÔNG bật security_invoker → chạy bằng quyền owner, bypass RLS.
-- Chúng lại được GRANT cho `anon`, mà anon key nằm công khai trong bundle JS ⇒ bất kỳ ai
-- trên internet cũng đọc được lương từng người (v_agent_salary), hồ sơ nhân sự
-- (v_agent_employees), đề xuất thay đổi nhân sự (v_agent_change_requests) — KHÔNG cần đăng nhập.
--
-- Verify trước khi vá: curl với anon key → HTTP 200 kèm dữ liệu thật.
-- Verify sau khi vá: cả 8 view trả HTTP 401.
--
-- An toàn để revoke: các view này chỉ phục vụ edge function agent-run, chạy bằng service_role
-- (grant service_role giữ nguyên). Frontend không tham chiếu 'v_agent_' ở đâu (grep 0 hit).
-- ĐÃ APPLY REMOTE 2026-08-09.
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'v\_agent\_%'
  loop
    execute format('revoke all on public.%I from anon, authenticated', v.relname);
  end loop;
end $$;

-- leave_balance_summary: cũng bypass RLS + grant anon → lộ tên NV + số ngày phép.
-- Frontend chỉ đọc khi đã đăng nhập → chỉ revoke anon, giữ authenticated.
revoke all on public.leave_balance_summary from anon;

-- hr_employees_tax_view: anon trả rỗng nhưng cùng nhóm rủi ro (bypass RLS + grant anon).
-- tax-portal đọc view này khi đã đăng nhập → chỉ revoke anon.
revoke all on public.hr_employees_tax_view from anon;
