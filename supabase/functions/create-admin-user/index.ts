// VÔ HIỆU HOÁ 2026-08-26 — lỗ hổng CRITICAL.
//
// Bản cũ: verify_jwt=false + CORS '*' + nhận {email, password, role} từ body rồi gọi
// auth.admin.createUser({ email_confirm: true }) bằng SERVICE_ROLE_KEY — KHÔNG kiểm quyền
// một dòng nào. Bất kỳ ai trên Internet curl một phát là có tài khoản đăng nhập được vào
// app.tdgamestudio.com. Đã chứng minh bằng thực nghiệm: POST body rỗng, không Authorization,
// không apikey → HTTP 400 "email, password, and role are required" (tức request vào thẳng
// logic, không qua lớp auth nào).
//
// Function này không có source trong repo, không chỗ nào trong code gọi tới (grep toàn repo
// ra rỗng), và thuộc cụm rác của dự án khác (TD Workflow) dùng chung Supabase project.
//
// Không XOÁ mà thay bằng 410 để hoàn tác được và để lộ ra ai còn gọi nó (soi log Supabase).
// Source gốc lưu ở `_archived/create-admin-user.original.ts` cùng thư mục cha.
// Xoá hẳn sau khi log im lặng vài tuần.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa vi lo hong bao mat (2026-08-26).',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    },
  )
);
