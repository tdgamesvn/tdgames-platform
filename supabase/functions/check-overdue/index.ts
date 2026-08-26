// VÔ HIỆU HOÁ 2026-08-26 — rác từ dự án khác, lại còn gửi email không cần auth.
//
// Bản cũ: verify_jwt=false, KHÔNG kiểm auth một dòng nào, chạy bằng SERVICE_ROLE_KEY.
// Ai biết URL cũng gọi được; mỗi lần gọi nó gửi email "task quá hạn" qua Resend tới
// freelancer và CC **toàn bộ admin**. Chống trùng chỉ dựa vào log cùng ngày, mà email
// lại gửi TRƯỚC khi ghi log ⇒ gọi song song là bắn hàng loạt: đốt hạn mức Resend,
// domain gửi bị đánh spam.
//
// Nhưng gốc rễ đơn giản hơn: nó đọc `tasks` / `profiles` / `task_logs` — CẢ BA BẢNG ĐỀU
// KHÔNG TỒN TẠI trong project này (đã kiểm information_schema 2026-08-26). Cùng cụm rác
// TD Workflow với email-notification / create-admin-user / admin-user-management / r2-upload,
// dùng chung Supabase project. `grep` toàn repo: không chỗ nào gọi. `cron.job`: không job nào gọi.
// ⇒ Mọi lần chạy đều lỗi từ trước tới nay. Không vá auth cho thứ vốn không nên tồn tại.
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
