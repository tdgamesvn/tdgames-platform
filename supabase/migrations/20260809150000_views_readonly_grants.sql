-- Việc 7 — view auto-updatable + security_invoker=off + grant ghi cho authenticated
-- = mọi user đã đăng nhập GHI thẳng được vào `hr_employees` bằng quyền owner (postgres),
-- bỏ qua toàn bộ RLS. Nặng hơn các lỗ đọc đã vá ở 20260809130000/140000.
--
-- Chứng minh trước khi vá (DB thật): `set role authenticated` + jwt `{"role":"member"}`
-- rồi `update public.hr_employee_directory set phone=phone where id='000...0'`
-- → KHÔNG lỗi quyền. Tức là member đổi được hồ sơ/xoá được nhân viên bất kỳ.
--
-- Nguyên nhân gốc: `GRANT ALL` (hoặc grant mặc định rộng) sót lại từ migration cũ.
-- Mọi view ở đây đều chỉ dùng để ĐỌC ⇒ revoke sạch rồi grant lại đúng SELECT.

-- 1) hr_employee_directory — danh bạ, Portal đọc (mọi NV đăng nhập).
revoke all on public.hr_employee_directory from anon, authenticated;
grant select on public.hr_employee_directory to authenticated;

-- 2) hr_employees_tax_view — Tax Portal đọc. View tự lọc dòng bằng
--    `jwt_has_any_role(['ke_toan_thue'])`, nhưng WHERE đó KHÔNG chặn INSERT
--    (không có WITH CHECK OPTION) ⇒ trước khi vá, user bất kỳ chèn được nhân viên mới.
revoke all on public.hr_employees_tax_view from anon, authenticated;
grant select on public.hr_employees_tax_view to authenticated;

-- 3) hr_employee_timeline — `security_invoker=on` nên đọc vẫn qua RLS (rủi ro thấp),
--    nhưng đang grant cả `anon`. Không auto-updatable (có UNION/join) nên không ghi được.
--    Dọn cho sạch: chỉ authenticated, chỉ SELECT.
revoke all on public.hr_employee_timeline from anon, authenticated;
grant select on public.hr_employee_timeline to authenticated;
