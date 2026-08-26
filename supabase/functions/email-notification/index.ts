// VÔ HIỆU HOÁ 2026-08-26 — rác từ dự án khác, lại còn gửi email không cần auth.
//
// Bản cũ: verify_jwt=false, không kiểm quyền, nhận {trigger, task_id} rồi gửi email.
// Nó đọc bảng `tasks` — bảng này KHÔNG TỒN TẠI trong project (cùng cụm rác TD Workflow
// với create-admin-user / admin-user-management / r2-upload, dùng chung Supabase project).
// `grep` toàn repo: không chỗ nào trong app gọi tới.
//
// Không xoá mà trả 410 để hoàn tác được và để lộ ra ai còn gọi (soi log Supabase).
// Xoá hẳn sau khi log im lặng vài tuần.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa (rac, khong auth) - 2026-08-26.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
