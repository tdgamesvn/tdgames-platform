// admin-update-user-role — VÔ HIỆU HOÁ 2026-08-26 (audit bảo mật Edge Function).
//
// Vì sao bỏ:
// 1. Cùng lỗ hổng với `admin-list-users`: guard là `user.user_metadata?.role !== 'admin'`, mà
//    `user_metadata` chính người dùng tự ghi được ⇒ coi như KHÔNG có kiểm quyền. Sau đó hàm
//    dùng SERVICE_ROLE gọi `auth.admin.updateUserById` để ghi `user_metadata.role` của BẤT KỲ
//    tài khoản nào. Không leo thang được xuống DB (RLS đọc `app_metadata`), nhưng đủ để một
//    tài khoản thường ghi đè metadata của người khác — client dựng `currentUser` từ
//    `user_metadata` nên nạn nhân bị đổi role hiển thị / mất quyền vào app.
// 2. Bản thân hàm có bug làm hỏng dữ liệu ngay cả khi admin thật dùng: lệnh update ĐẦU TIÊN
//    ghi `{...user.user_metadata, role}` — tức metadata của NGƯỜI GỌI — đè lên tài khoản đích
//    (mất `employee_id`, `username` của nạn nhân). Lệnh `getUserById` đọc lại sau đó nên chỉ
//    đọc được bản đã hỏng, lần update thứ hai giữ nguyên cái sai.
// 3. Không chỗ nào trong repo hay `cron.job` gọi hàm này. Đổi role đi qua `EmployeeDetail` →
//    `create-employee-auth` action `update_role` (ghi `app_metadata`, có guard).
//
// Trả 410 thay vì xoá: hoàn tác được, và log Supabase sẽ lộ ra nếu còn ai gọi.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: 'Gone: admin-update-user-role da bi vo hieu hoa (audit bao mat 2026-08-26)' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
