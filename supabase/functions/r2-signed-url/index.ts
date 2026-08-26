// VÔ HIỆU HOÁ 2026-08-26 — rác TD Workflow, đã chết sẵn.
//
// Bản cũ: verify_jwt=false, tự kiểm Bearer token (chỉ cần đăng nhập bất kỳ, không lọc
// role). Nhận `task_id`, đọc `tasks.r2_source_url` rồi ký presigned URL R2 hạn 7 ngày.
//
// Bảng `tasks` KHÔNG TỒN TẠI trong project này (kiểm information_schema 2026-08-26 —
// chỉ có `wf_tasks`) ⇒ mọi lượt gọi chết ở query, trả 404 "Task not found". Chưa từng
// ký nổi một URL nào. `grep` toàn repo: không chỗ nào gọi.
//
// Nếu bảng `tasks` từng tồn tại thì đây là lỗ đọc file chéo: chỉ cần dò `task_id` là có
// presigned URL 7 ngày tới file nguồn của task bất kỳ, không kiểm người gọi có quyền
// với task đó không. Lý do nữa để không hồi sinh nguyên trạng.
//
// Không lưu bản gốc: thao tác trên bảng không tồn tại, khôi phục vô nghĩa.
//
// Giữ verify_jwt=false để 410 lộ ra ai còn gọi trong log Supabase. Xoá hẳn sau vài tuần.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa (rac TD Workflow) - 2026-08-26.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
