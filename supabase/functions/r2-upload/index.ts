// VÔ HIỆU HOÁ 2026-08-26 — rác TD Workflow, nhưng KHÔNG vô hại.
//
// Bản cũ: verify_jwt=false, tự kiểm Bearer token nên chỉ cần đăng nhập BẤT KỲ (member,
// freelancer) là qua — không lọc role. Nhận multipart form rồi `PutObjectCommand` đẩy
// thẳng lên bucket R2 công ty với key `tasks/<task_id>/<type>_<ts>.<ext>`, trong đó
// `task_id`/`type`/tên file do client đặt hết.
//
// Mấu chốt: upload lên R2 chạy TRƯỚC, `.from('tasks').update(...)` chạy SAU. Mà bảng
// `tasks` và `task_logs` KHÔNG TỒN TẠI trong project này (kiểm information_schema
// 2026-08-26 — chỉ có `wf_tasks`). Nên mỗi lượt gọi đều trả 500 "DB update failed"
// NHƯNG FILE ĐÃ NẰM TRONG R2 RỒI. Tức là một endpoint bơm rác vào storage công ty,
// không hạn dung lượng, không dọn, chỉ cần một tài khoản nhân viên bất kỳ.
//
// Cùng cụm rác TD Workflow với check-overdue / email-notification / create-admin-user /
// admin-user-management / r2-signed-url (chung Supabase project). `grep` toàn repo:
// không chỗ nào gọi. Luồng upload thật của app là `r2-expense-upload` (đã vá guard ở
// commit 92f2367).
//
// Không lưu bản gốc: nó thao tác trên bảng không tồn tại, khôi phục là vô nghĩa; phần
// logic S3/R2 duy nhất đáng giữ đã có sẵn trong `r2-expense-upload`.
//
// Giữ verify_jwt=false để gateway không nuốt request — cần 410 lộ ra ai còn gọi trong
// log Supabase. Xoá hẳn sau khi log im lặng vài tuần.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa (rac TD Workflow, bom file vao R2) - 2026-08-26.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
