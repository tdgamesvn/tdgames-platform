// VÔ HIỆU HOÁ 2026-08-26 — rac TD Workflow — dung bang profiles/projects/tasks, ca 3 KHONG ton tai. Guard admin dua vao profiles => min hen gio: ai tao bang ten do la guard tan. 0 cho goi.
//
// verify_jwt: true KHÔNG bảo vệ được gì: anon key cũng là JWT hợp lệ và nằm công khai
// trong bundle JS của app.tdgamestudio.com ⇒ gateway cho qua, thân hàm không kiểm role.
// Giữ 410 thay vì xoá: hoàn tác được, và caller nào còn gọi sẽ hiện lên log Supabase.
// Muốn bật lại: khôi phục source (supabase/functions/_archived/ hoặc git history) RỒI
// thêm guard Bearer + kiểm role qua app_metadata — mẫu chuẩn: outreach-auto-batch.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Gone", message: "generate-invoice da bi vo hieu hoa (2026-08-26)." }),
    { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  )
);
