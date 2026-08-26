// admin-list-users — VÔ HIỆU HOÁ 2026-08-26 (audit bảo mật Edge Function).
//
// Vì sao bỏ:
// 1. Guard cũ là `user.user_metadata?.role !== 'admin'`. `user_metadata` do CHÍNH người dùng
//    ghi được (`supabase.auth.updateUser({ data: { role: 'admin' } })`) ⇒ mọi tài khoản đã
//    đăng nhập, kể cả 4 tài khoản freelancer, tự nâng mình lên "admin" trong 1 request rồi
//    gọi hàm này. RLS của dự án đọc `app_metadata` (xem `public.jwt_roles()`) nên DB vẫn kín,
//    nhưng hàm này chạy SERVICE_ROLE ⇒ trả về TOÀN BỘ 500 tài khoản: email, username, role,
//    employee_id, thời điểm đăng nhập gần nhất. Danh sách nhân sự + email nội bộ rò trọn gói.
// 2. Không một chỗ nào trong repo hay trong `cron.job` gọi hàm này. Luồng quản lý tài khoản
//    thật đi qua `create-employee-auth` / `manage-employee-auth` (đã có guard `app_metadata`).
//
// Trả 410 thay vì xoá: hoàn tác được, và log Supabase sẽ lộ ra nếu còn ai gọi.
// Cần dựng lại thì copy khối auth của `manage-employee-auth` (đọc `app_metadata`, KHÔNG phải
// `user_metadata`) rồi mới bật.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: 'Gone: admin-list-users da bi vo hieu hoa (audit bao mat 2026-08-26)' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
