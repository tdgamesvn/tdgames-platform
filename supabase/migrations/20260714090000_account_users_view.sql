-- ============================================================
-- account_users view (2026-07-14)
-- Bug: StudiosTab.tsx và ClientForm.tsx query bảng `account_users`
-- để lấy danh sách nhân viên có role 'bd' (gán "BD phụ trách" cho
-- studio / khách hàng) nhưng bảng này CHƯA TỪNG được tạo bằng
-- migration nào — chỉ được giả định tồn tại trong design doc.
-- → dropdown "Chọn BD" luôn rỗng cho MỌI user (không riêng ai).
-- Role + secondary_roles chỉ tồn tại trong auth.users.raw_user_meta_data,
-- client (anon/authenticated key) không được query trực tiếp auth.users
-- → cần 1 view public expose các field an toàn (không email/token).
-- ============================================================

CREATE OR REPLACE VIEW public.account_users AS
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'username') AS full_name,
  COALESCE(u.raw_user_meta_data->>'role', 'member') AS role,
  COALESCE(
    (
      SELECT array_agg(v)
      FROM jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(u.raw_user_meta_data->'secondary_roles') = 'array'
             THEN u.raw_user_meta_data->'secondary_roles'
             ELSE '[]'::jsonb
        END
      ) v
    ),
    ARRAY[]::text[]
  ) AS secondary_roles
FROM auth.users u
WHERE u.deleted_at IS NULL
  AND (u.banned_until IS NULL OR u.banned_until < now());

-- Chỉ nhân viên đã đăng nhập mới xem được (không email, không dữ liệu nhạy cảm khác)
GRANT SELECT ON public.account_users TO authenticated;
REVOKE ALL ON public.account_users FROM anon;
