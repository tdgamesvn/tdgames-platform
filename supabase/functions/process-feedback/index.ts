// VÔ HIỆU HOÁ 2026-08-26 — rac TD Workflow — dung fb_comments/fb_review_items/fb_clickup_tokens, ca 3 KHONG ton tai. 0 cho goi.
//
// verify_jwt: true KHÔNG bảo vệ được gì: anon key cũng là JWT hợp lệ và nằm công khai
// trong bundle JS của app.tdgamestudio.com ⇒ gateway cho qua, thân hàm không kiểm role.
// Giữ 410 thay vì xoá: hoàn tác được, và caller nào còn gọi sẽ hiện lên log Supabase.
// Muốn bật lại: khôi phục source (supabase/functions/_archived/ hoặc git history) RỒI
// thêm guard Bearer + kiểm role qua app_metadata — mẫu chuẩn: outreach-auto-batch.
Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Gone", message: "process-feedback da bi vo hieu hoa (2026-08-26)." }),
    { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  )
);
