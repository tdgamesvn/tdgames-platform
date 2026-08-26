// VÔ HIỆU HOÁ 2026-08-26 — rác TD Workflow, là quả mìn hẹn giờ chứ không chỉ là rác.
//
// Bản cũ: verify_jwt=false, tự gác bằng `verifyAdmin()` — đọc `profiles` để lấy role và
// đòi `role === 'admin'`. Sau cửa đó là toàn quyền auth admin: `auth.admin.createUser`,
// `deleteUser` (xoá vĩnh viễn tài khoản), `updateUserById` ban 100 năm, `generateLink`
// magiclink rồi gửi qua Resend từ `noreply@tdgamestudio.com`, cộng CRUD `organizations`
// và `projects`.
//
// Hiện tại nó chết ở ngay `verifyAdmin`: bảng `profiles` KHÔNG TỒN TẠI trong project này
// (kiểm information_schema 2026-08-26), nên `.single()` lỗi ⇒ luôn trả 401 "Profile not
// found". `organizations`/`projects` cũng không tồn tại. `grep` toàn repo: không chỗ nào gọi.
//
// Nguy hiểm nằm ở chỗ này: cái chắn duy nhất là MỘT BẢNG KHÔNG TỒN TẠI. Ngày nào có ai
// tạo bảng tên `profiles` trong project này (tên quá phổ biến — đúng convention mặc định
// của Supabase), guard tự tan: `profileError` hết lỗi, và ai có dòng `role='admin'` ở đó
// là cầm nguyên bộ API xoá/ban/tạo tài khoản trên auth THẬT của app. App này định danh
// quyền bằng `app_metadata.role`, không dùng bảng `profiles` — nên bảng đó có thể bị dựng
// lên cho việc khác mà không ai nghĩ tới hệ quả này.
//
// Cùng cụm rác TD Workflow với check-overdue / email-notification / create-admin-user /
// r2-upload / r2-signed-url (chung Supabase project).
//
// Không lưu bản gốc: khôi phục nguyên trạng là dựng lại đúng quả mìn trên. Luồng quản lý
// tài khoản thật của app là `create-employee-auth` / `manage-employee-auth` (đã vá guard
// đọc `app_metadata`, commit 01dd097 + bfbcf4b).
//
// Giữ verify_jwt=false để 410 lộ ra ai còn gọi trong log Supabase. Xoá hẳn sau vài tuần.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa (rac TD Workflow, guard dua vao bang khong ton tai) - 2026-08-26.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
