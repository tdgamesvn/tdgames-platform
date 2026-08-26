// VÔ HIỆU HOÁ 2026-08-26 — endpoint mở toang có quyền TẠO HOÁ ĐƠN THẬT.
//
// Bản cũ: verify_jwt=false, không kiểm auth một dòng nào (`req` khai báo rồi bỏ luôn),
// chạy bằng SERVICE_ROLE_KEY và INSERT thẳng vào `invoice_invoices`.
// Gọi song song vài chục request: tất cả cùng đọc `next_run` cũ trước khi update nào commit
// (không khoá, không transaction) ⇒ sinh N hoá đơn trùng, và vì số hoá đơn tính bằng
// max(seq)+1 đọc-trước-ghi nên nhiều hoá đơn TRÙNG `invoice_number` — hỏng sổ kế toán,
// gần như không dọn tự động được.
//
// Vì sao 410 thay vì vá guard (kiểm 2026-08-26):
//   - `cron.job`: KHÔNG job nào gọi function này.
//   - `grep` toàn repo: không code nào gọi.
//   - `select count(*) from invoice_recurring` = 0 dòng.
// ⇒ Tính năng hoá đơn định kỳ chưa từng chạy. Dựng secret + cron job cho thứ chưa dùng là
// thừa; đóng cửa trước, mở lại khi thật sự cần.
//
// KHI NÀO BẬT LẠI: nếu dùng hoá đơn định kỳ thì `git revert` commit này, ĐỒNG THỜI (a) thêm
// khối auth x-cron-secret theo mẫu `outreach-auto-batch`, (b) tạo cron job có gửi secret đó,
// (c) đổi cách cấp số hoá đơn sang sequence DB để hết race trùng số.
Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: 'Gone: function nay da bi vo hieu hoa (khong auth, chua dung) - 2026-08-26.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
);
