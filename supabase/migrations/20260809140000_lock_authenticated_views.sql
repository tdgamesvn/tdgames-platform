-- Việc 6 — view còn grant `authenticated` (bypass RLS vì security_invoker=off).
-- Anon đã bị chặn ở 20260809130000; đây là bịt nốt rò rỉ nội bộ giữa các user đã đăng nhập.
--
-- KHÔNG đụng `hr_employees_tax_view`: view đó đã tự chặn bằng
-- `WHERE jwt_has_any_role(ARRAY['ke_toan_thue'])` ngay trong định nghĩa.
--
-- KHÔNG đụng `hr_employee_directory`: sếp chốt 2026-08-09 — ngày sinh + địa chỉ
-- đồng nghiệp không cần ẩn trong danh bạ nội bộ.

-- 1) leave_balance_summary — tên NV + ngày phép toàn công ty, mọi user đăng nhập đọc được.
--    Frontend không tham chiếu view này ở đâu (Portal đọc thẳng bảng `leave_balances` có RLS),
--    nên revoke sạch là đủ; service_role (edge function/agent) giữ nguyên quyền.
revoke all on public.leave_balance_summary from anon, authenticated;

-- 2) account_users — danh sách toàn bộ tài khoản auth + role. Chỉ CRM dùng
--    (ClientForm, StudiosTab: dropdown "BD phụ trách"), người mở CRM luôn thuộc 4 role dưới.
--    `jwt_roles()` gộp cả secondary_roles nên BD (thường là secondary) vẫn đọc được.
create or replace view public.account_users as
  select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'username') as full_name,
    coalesce(u.raw_user_meta_data ->> 'role', 'member') as role,
    coalesce((
      select array_agg(v.value)
      from jsonb_array_elements_text(
        case when jsonb_typeof(u.raw_user_meta_data -> 'secondary_roles') = 'array'
             then u.raw_user_meta_data -> 'secondary_roles'
             else '[]'::jsonb end
      ) v
    ), array[]::text[]) as secondary_roles
  from auth.users u
  where u.deleted_at is null
    and (u.banned_until is null or u.banned_until < now())
    and public.jwt_has_any_role(array['admin', 'ke_toan', 'hr', 'bd']);

-- Grant cũ lỡ cấp cả INSERT/UPDATE/DELETE cho authenticated (view auto-updatable +
-- security_invoker=off ⇒ ghi thẳng auth.users bằng quyền owner). Revoke sạch rồi grant lại SELECT.
revoke all on public.account_users from anon, authenticated;
grant select on public.account_users to authenticated;
