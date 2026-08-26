// client-portal — VÔ HIỆU HOÁ 2026-08-26 (audit bảo mật Edge Function).
//
// Vì sao bỏ:
// 1. Rác còn sót từ TD Workflow. 6 bảng nó đọc/ghi — `profiles`, `client_portal_tokens`,
//    `projects`, `tasks`, `feedbacks`, `task_logs` — đều KHÔNG tồn tại trong DB hiện tại
//    (đo `information_schema.tables` 2026-08-26: 0/6). Mọi action đều chết ở query đầu tiên.
// 2. 0 chỗ gọi trong repo. Cổng khách hàng thật của dự án đi qua CRM, không qua hàm này.
// 3. Nếu ai đó vô tình tạo bảng trùng tên (`profiles`, `tasks`... là tên mặc định rất phổ biến
//    của Supabase) thì hàm sống dậy với `verify_jwt: false` + service_role: action `verify`
//    và `feedback` chỉ gác bằng `token` trong body — dò được token là đọc project/task/file
//    preview và đổi status task của khách. Guard admin của action `generate` lại dựa vào bảng
//    `profiles` không tồn tại (cùng mìn hẹn giờ với `admin-user-management`).
//
// Trả 410 thay vì xoá, và GIỮ `verify_jwt: false` để request nào còn gọi vẫn chạm vào hàm và
// hiện lên log Supabase. Im lặng vài tuần thì xoá hẳn.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: 'Gone: client-portal da bi vo hieu hoa (audit bao mat 2026-08-26)' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
