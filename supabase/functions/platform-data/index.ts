// VÔ HIỆU HOÁ 2026-08-26 — service_role + KHONG kiem role. Probe bang anon key cong khai -> 200, tra tong doanh thu/chi phi/P&L; hr_summary tra danh sach nhan vien + base_salary hop dong; payroll_summary tra tong luong. 0 cho goi trong repo, 0 cron.
//
// verify_jwt: true KHÔNG bảo vệ được gì: anon key cũng là JWT hợp lệ và nằm công khai
// trong bundle JS của app.tdgamestudio.com ⇒ gateway cho qua, thân hàm không kiểm role.
// Giữ 410 thay vì xoá: hoàn tác được, và caller nào còn gọi sẽ hiện lên log Supabase.
// Muốn bật lại: khôi phục source (supabase/functions/_archived/ hoặc git history) RỒI
// thêm guard Bearer + kiểm role qua app_metadata — mẫu chuẩn: outreach-auto-batch.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Gone", message: "platform-data da bi vo hieu hoa (2026-08-26)." }),
    { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  )
);
