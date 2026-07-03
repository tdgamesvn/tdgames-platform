# RECENT — 5 sessions gần nhất

_Auto-generated từ LOG.md. Không sửa tay._

---

## 2026-07-03 (session 18, phần 3 — fix bug trùng tên hàm)
### Task
Sếp báo Discord nhận 2 tin giống hệt nhau sau khi em chạy thử luồng xác nhận bảng lương T6/2026 (rollback + confirm lại qua SQL để test thay vì bắt sếp bấm tay).

### Root cause
Hàm `notify_payroll_confirmed()` em tạo ở migration `20260707120000` TRÙNG TÊN với 1 hàm đã tồn tại từ 2026-06-03 (`20260603100000_payroll_employee_acknowledgement.sql`), gắn với trigger có sẵn `trg_notify_payroll_confirmed` — hàm gốc dùng để insert vào bảng `notifications` cho từng nhân viên + kích hoạt gửi email thật ("Phiếu lương cần xác nhận") khi bảng lương được xác nhận. Em không kiểm tra trùng tên trước khi `CREATE OR REPLACE FUNCTION` → ghi đè mất logic gốc mà không có cảnh báo gì (Postgres cho phép replace function tự do). Khi test bằng cách UPDATE status draft→confirmed qua SQL, CẢ 2 trigger (`trg_notify_payroll_confirmed` gốc + `trg_payroll_discord_confirmed` mới) cùng gọi chung 1 hàm (đã bị ghi đè bởi code Discord) → Discord nhận 2 tin giống hệt, đồng thời in-app notification/email thật cho nhân viên bị hỏng ngầm trong lúc đó.

### Work Done
- Migration `20260707140000_fix_payroll_notify_function_collision.sql`:
  1. Khôi phục nguyên bản `notify_payroll_confirmed()` (in-app notification + trigger email) — copy chính xác từ `20260603100000`.
  2. Đổi tên hàm gửi Discord thành `notify_payroll_confirmed_discord()`.
  3. Trỏ lại trigger `trg_payroll_discord_confirmed` sang hàm mới, giữ nguyên điều kiện WHEN.
- Verify qua `pg_trigger` (`pg_get_triggerdef`): `trg_notify_payroll_confirmed` → `notify_payroll_confirmed()` (hàm gốc), `trg_payroll_discord_confirmed` → `notify_payroll_confirmed_discord()` (hàm Discord) — 2 hàm tách biệt hoàn toàn, không còn đụng độ.

### Impact thực tế
- Sheet T6/2026 đã có 1 lần confirm THẬT trước đó (06:10:17, trước khi em đụng vào gì) — email thật đã gửi đúng cho nhân viên lúc đó (verify qua `net._http_response`, thấy request tới `notify-email` thành công, `to: tunv.tdgame@gmail.com`). Lần em test sau (06:28:11, sau khi hàm đã bị ghi đè) KHÔNG gửi lại notification/email cho nhân viên (vì hàm lúc đó là code Discord) — không có nhân viên nào bị spam email trùng, nhưng cũng không có ai được notify thật ở lần test đó. Không cần khắc phục thêm vì nhân viên đã được thông báo đúng ở lần confirm thật.

### Validation
- Chưa test lại thật (chưa xác nhận thêm 1 lần nữa để xem cả 2 trigger có chạy đúng, độc lập, không đụng nhau không) — nên tránh test thêm trên sheet thật để không gửi thêm Discord/email không cần thiết. Nếu sếp muốn verify lại, nên test trên 1 sheet nháp/demo thay vì sheet thật.

### Blockers
none

### Next Step
- **Bài học cho các session sau**: trước khi `CREATE OR REPLACE FUNCTION` cho bất kỳ hàm nào tưởng là mới, PHẢI grep tên hàm trong `supabase/migrations/` (hoặc chạy `gitnexus_impact`) để chắc chắn không trùng tên với hàm đã có — đúng rule "MUST run impact analysis before editing any symbol" trong CLAUDE.md mà session này đã bỏ qua.

---

## 2026-07-03 (session 18, phần 2 — sửa format)
### Task
Sếp phát hiện format tin Discord em build lúc trước SAI mục đích: gửi báo cáo tài chính nội bộ (tổng lương Net, tổng chi phí công ty) và định gắn @everyone — sẽ lộ số liệu lương ra toàn công ty. Tính năng thật ra dùng để THÔNG BÁO CHO NHÂN VIÊN vào app tự xác nhận phiếu lương của mình, không phải báo cáo tài chính cho admin.

### Work Done
- Viết lại `notify_payroll_confirmed()` — bỏ hoàn toàn phần SUM(net_salary)/SUM(total_company_cost)/tên người xác nhận. Nội dung mới: `content: '@everyone'` (mention phải nằm ở content mới ping được, không ping nếu để trong embed) + 1 embed `description` chứa thông báo dạng markdown (heading ### + hướng dẫn 3 bước + lưu ý + link Portal), màu brand `#FF9500`, footer "TD Games • Phòng Hành chính - Nhân sự" — mirror đúng format mẫu sếp đã dùng thủ công ở session 17.
- Migration: `20260707130000_fix_payroll_discord_employee_announcement.sql` (CREATE OR REPLACE FUNCTION, không đụng trigger đã tạo trước) — applied qua Supabase MCP.
- Trigger condition giữ nguyên: fire khi `pay_payroll_sheets.status` chuyển sang 'confirmed'.

### Validation
- Chưa test end-to-end thật trên UI — cần sếp xác nhận/rollback+xác nhận lại 1 bảng lương thật để kiểm tra tin lên đúng kênh, đúng nội dung, @everyone ping đúng.

### Blockers
none

### Next Step
- Chờ sếp test thật. Nếu cần chỉnh câu chữ/emoji, sửa trực tiếp trong function `notify_payroll_confirmed()`.

---

## 2026-07-03 (session 18)
### Task
Sếp tưởng nhầm tính năng "xác nhận bảng lương → tự động gửi Discord" đã tồn tại (nhầm lẫn với 1 tin gửi tay 1 lần ở session 17). Em xác nhận không có, rồi sếp yêu cầu build thật, kèm sẵn webhook URL Discord.

### Work Done
- Khảo sát pattern Discord notification hiện có trong repo (attendance, CRM document approval) — tất cả đều dùng DB trigger (`SECURITY DEFINER` + `net.http_post`) đọc webhook URL từ bảng `app_config` (key-value, RLS chặn anon/authenticated), KHÔNG hardcode URL trong migration để tránh lộ qua git history.
- Tạo `notify_payroll_confirmed()` trigger function: fire trên `pay_payroll_sheets` AFTER UPDATE OF status, chỉ khi `NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed'` (không fire lặp khi save linh tinh, fire lại nếu rollback rồi confirm lại). Nội dung embed: tóm tắt tổng quan (số nhân viên, tổng lương Net, tổng chi phí công ty, người xác nhận — resolve qua `auth.users` + `hr_employees.auth_user_id`), KHÔNG liệt kê breakdown lương từng người (tránh lộ lương cá nhân lên kênh chung). Không mention `@everyone`.
- Migration: `supabase/migrations/20260707120000_payroll_discord_notifications.sql` — applied qua Supabase MCP (`apply_migration`).
- Webhook URL sếp cung cấp (`.../webhooks/1522401822629691492/...`) set trực tiếp vào `app_config` bằng `execute_sql` (INSERT ON CONFLICT), KHÔNG lưu trong file migration/git.
- Quyết định nội dung/mention/trigger scope dựa trên default "Recommended" trong AskUserQuestion vì sếp không trả lời — chỉ trigger khi status → 'confirmed' (không thêm cho 'paid').

### Validation
- Chưa test end-to-end thật (chưa bấm nút Xác nhận trên UI thật để xem tin có lên Discord không) — cần sếp xác nhận bằng cách xác nhận (hoặc rollback rồi xác nhận lại) 1 bảng lương thật và kiểm tra kênh Discord.
- Chưa chạy `npm run build` vì không có thay đổi code frontend (chỉ migration SQL).

### Blockers
none

### Next Step
- Chờ sếp test thật trên UI + xác nhận tin nhắn lên đúng kênh, đúng format trước khi coi là done hẳn.
- Nếu sếp muốn thêm thông báo cho mốc "Đã trả lương" (paid) hoặc breakdown từng nhân viên, mở rộng trigger sau.

---

## 2026-07-03 (session 17)
### Task
Sếp báo lương T6/2026 của Nguyễn Văn Tú bị tính sai — lên chính thức giữa tháng nhưng KPI/Tăng ca của cả tháng bị tính theo mức MỚI (sau khi lên chính thức) thay vì blend đúng giai đoạn thử việc/chính thức. Cơ chế blend này đã có sẵn cho Lương cơ bản (từ session 2026-06-12) nhưng chưa bao giờ mở rộng sang KPI/OT. Sếp yêu cầu: tổng quát hoá cơ chế, auto-detect từ lịch sử, không thêm UI nhập tay (ban đầu) — sau đó yêu cầu thêm rà tất cả NV chuyển giao trong tháng (không chỉ Tú), rồi cuối cùng quay lại yêu cầu thêm UI nhập tay mirror UI Lương CB.

### Work Done
- **Root cause**: `calculatePayroll` (payrollService.ts) có `preOfficialBaseSalary` blend `old*probRatio + new*officialRatio` nhưng KPI/`default_ot` luôn dùng thẳng mức hiện tại × ratio ngày công, không blend theo giai đoạn.
- **Fix code**: thêm `preOfficialKpiAllowance`/`preOfficialDefaultOt` vào `PayrollInput` + `effectiveKpiAllowance`/`effectiveDefaultOt` (mirror `effectiveBaseSalary`). `createPayrollSheet` tổng quát hoá `salaryChangeMap` sang 3 component (Lương CB/KPI/Tăng ca).
- **Bug phát hiện giữa chừng**: heuristic ban đầu "so 2 bản ghi `hr_employee_salary` gần nhất" (đúng như code cũ đã làm cho base_salary) SAI khi có sửa/correct nhiều lần trong cùng ngày — case thật: Nguyễn Đức Hiếu bị sửa Tăng ca 2 lần liền trong ngày 23/6 (1.100.000 → 1.070.000, cả 2 đều SAU official_date), heuristic "2 bản ghi cuối" sẽ lấy nhầm 1.100.000 làm mức thử việc (đúng ra là 400.000 từ 4/15). Sửa: tách theo `official_date` (bản ghi cuối TRƯỚC official_date = pre-official, bản ghi cuối cùng overall = current), verify đúng cho cả 3 NV.
- **DB**: migration `20260707100000_add_pre_official_kpi_ot_pay_payroll_records.sql` — 2 cột `pre_official_kpi_allowance`/`pre_official_default_ot` (bigint, nullable), applied qua Supabase MCP.
- **UI**: thêm 2 ô nhập tay (KPI cũ TV / Tăng ca cũ TV) trong panel "Chi tiết tính lương" của `PayrollSheet.tsx`, mirror y hệt UI Lương CB đã có (input khi draft, hiển thị Prorate). Giá trị mặc định = auto-detect từ `createPayrollSheet`, kế toán chỉ sửa khi cần.
- **Data fix T6/2026**: rà toàn bộ sheet, tìm 3 NV chuyển giao (không chỉ Tú): Nguyễn Văn Tú, Nguyễn Đức Hiếu, Đinh Trí Bảo Anh. Tính tay theo đúng công thức (verify ngược khớp 100% với giá trị cũ trong DB trước khi tin công thức), UPDATE trực tiếp `gross_actual`/`taxable_income`/`pit`/`net_salary`/`total_company_cost` + 2 cột pre_official mới cho cả 3 record. KHÔNG xoá-tạo-lại sheet vì sheet có 4/6 record đã nhập bonus tay + 3/6 có note công ty (VD lời chúc mừng của Tú) — xoá-tạo-lại sẽ mất hết vì `createPayrollSheet` insert `bonus: 0` mặc định.
- **Kết quả net**: Tú 15.965.000→14.216.652, Hiếu 14.010.454→12.716.653, Bảo Anh 13.453.444→11.610.473.
- **Validation**: `npm run lint` — không phát sinh lỗi TS mới (lỗi pre-existing không liên quan payroll không đụng tới). Không có test runner trong repo (không vitest/jest) nên verify công thức bằng tính tay + đối chiếu ngược với giá trị DB cũ (khớp exact ở từng bước rounding) trước khi áp giá trị mới.
- Commits: `4e53202` (calculatePayroll + createPayrollSheet + recalculateRecord + types + migration + plan doc), `afd2db7` (UI KPI/OT input).
- Plan doc: `docs/superpowers/plans/2026-07-03-payroll-pre-official-kpi-ot-blend.md`.

### Ghi chú follow-up
- Chỉ sheet **mới tạo** (createPayrollSheet) mới auto-detect; các tháng cũ hơn T6/2026 nếu có case tương tự sẽ không tự sửa — cần rà riêng nếu sếp yêu cầu.
- Nhân viên (Portal) chỉ thấy net/gross/BH/thuế/bonus/note trong `PayslipAcknowledgeModal.tsx` — KHÔNG thấy breakdown probation_ratio hay mức lương cũ/mới. Breakdown chỉ có ở admin side (PayrollSheet.tsx).

## 2026-07-01 (session 16)
### Task
Sếp báo: luồng SePay không check được hoá đơn đã ký số chưa, invoice lúc nào cũng bị để "Nháp" mãi. Yêu cầu kiểm tra lại.

### Work Done
- Gọi trực tiếp `sepay-proxy` action `get-invoice-detail` (curl) cho từng hoá đơn đang `einvoice_status='draft'` trong DB để xem trạng thái THẬT trên SePay:
  - `INV-202606-011` → SePay trả `status: "issued"`, `invoice_number: "9"`, có `tax_authority_code` (đã ký CQT thật) — nhưng DB vẫn ghi `draft`.
  - Kiểm tra luôn 6 draft còn lại: `INV-202603-005` (thật sự vẫn `pending`), còn `INV-202604-006/007/008`, `INV-202605-009/010` đều đã `issued` (invoice_number 4,5,6,7,8) nhưng DB vẫn ghi `draft`.
  - Kết luận: đây là bug lan rộng (5/6 draft hiện có đều đã ký số thật ngoài SePay nhưng app không nhận ra), không phải case đơn lẻ.
- **Root cause**: code check status (`getEInvoiceDetail` trong `sePayService.ts` + `doSync` trong `useInvoiceState.ts`) hoạt động ĐÚNG về logic (đã verify qua curl) — vấn đề là nó CHỈ chạy khi người dùng tự bấm nút "🔄 Refresh" trong History, không có cơ chế tự động nào cả. Vì vậy hoá đơn ký số xong trên SePay Portal nhưng không ai nhớ bấm Refresh → mãi mãi hiển thị "Nháp" trong app.
- **Data fix**: update trực tiếp DB cho 6 hoá đơn trên (5 → `issued` + đúng `einvoice_invoice_number`, 1 giữ `draft` vì đúng là còn pending thật).
- **Code fix**: `useInvoiceState.ts` — `syncEInvoiceStatuses` nhận thêm `opts?: {silent?: boolean}` (dùng `silentSyncRef` để không ép thêm dependency vào effect); khi `silent=true` chỉ hiện toast nếu THẬT SỰ có thay đổi (bỏ qua toast "no drafts"/"no changes" để tránh làm phiền). Effect `[activeTab]` — khi vào tab History, gọi `syncEInvoiceStatuses({silent:true})` thay vì chỉ `loadHistory()` trơn → tự động check + cập nhật trạng thái ký số mỗi lần mở History, không cần nhớ bấm Refresh nữa. Nút "🔄 Refresh" thủ công vẫn giữ nguyên hành vi cũ (luôn báo toast).

### Validation
- `npm run build` ✅ (542 modules, 9.65s, 0 lỗi TypeScript)
- Verify sống qua curl trực tiếp `sepay-proxy get-invoice-detail` cho toàn bộ 7 hoá đơn draft trong DB (không chỉ 1 case) — xác nhận chính xác cái nào issued/pending trước khi update SQL.
- Chưa test lại UI thật (chưa mở `npm run dev` để xác nhận silent sync chạy đúng khi click vào tab History) — sếp nên thử: tạo 1 draft mới, ký số bên SePay Portal, quay lại History (không bấm Refresh) → xem có tự chuyển "Đã Ký" không.

### Result
6 hoá đơn cũ đã đúng trạng thái thật (5 issued, 1 vẫn pending thật). Từ nay vào History sẽ tự động re-check trạng thái ký số SePay, không còn phụ thuộc việc người dùng nhớ bấm nút Refresh — tránh tái diễn tình trạng hoá đơn ký xong vẫn hiện "Nháp".

### Blockers
none

### Next Step
- Chưa commit — chờ sếp xác nhận test OK rồi commit + push.

---

## 2026-07-01 (session 15)
### Task
Thêm nút "Tải PDF hoá đơn TD Games" (bản thương hiệu, khác eInvoice SePay) trực tiếp trong History — trước đó chỉ tải được PDF eInvoice của SePay, muốn tải lại PDF hoá đơn TD Games phải bấm Edit → Preview → Export thủ công. Kèm yêu cầu thêm: cho chọn Light/Dark Theme ngay lúc tải, không phụ thuộc theme đã lưu sẵn của hoá đơn.

### Work Done
- `useInvoiceState.ts`:
  - `handleExport` nhận thêm `opts?: { targetInvoice?, skipSavePrompt? }` — dùng `targetInvoice` thay vì đọc `invoice` từ closure (tránh bug đọc giá trị cũ do `setInvoice` là async), và `skipSavePrompt` để bỏ qua modal "Save Invoice?" khi chỉ đang tải lại PDF của hoá đơn đã lưu sẵn.
  - Thêm state `pdfThemeChoiceInv` (giống pattern `resetConfirmId`) + 3 handler: `handleDownloadInvoicePdf(inv)` (mở popup hỏi theme), `confirmDownloadInvoicePdf(theme)` (set `{...inv, theme}` vào `invoice` state, chuyển tab Preview, chờ render, gọi `exportToPDF` → trigger browser print dialog, tự quay lại tab History sau khi đóng dialog in nhờ lắng nghe event `afterprint`, có fallback dọn listener sau 60s), `cancelDownloadInvoicePdf()`.
- `HistoryTab.tsx`: thêm nút mới (icon download-tray, màu sky, giữa Clone và nút eInvoice) gọi `onDownloadInvoicePdf`; thêm popup chọn Light/Dark Theme (2 nút lớn, style giống preview sáng/tối thật) trước khi export, theo đúng pattern modal `resetConfirmId` đã có sẵn trong file.
- `InvoiceApp.tsx`: wire 4 prop mới (`onDownloadInvoicePdf`, `pdfThemeChoiceInv`, `onConfirmDownloadInvoicePdf`, `onCancelDownloadInvoicePdf`) từ state hook xuống HistoryTab.
- Cơ chế in PDF tận dụng nguyên `@media print` CSS có sẵn trong `index.html` (chỉ hiện `#invoice-capture`, ẩn nav/sidebar/button) — không cần code mới cho phần render/in, chỉ cần đảm bảo đúng invoice + đúng theme được load vào state trước khi `window.print()` chạy.

### Validation
- `npm run build` ✅ (542 modules, 9.65s, 0 lỗi TypeScript)
- Review thủ công toàn bộ diff (`useInvoiceState.ts` +59/-, `HistoryTab.tsx` +40/-, `InvoiceApp.tsx` +4) — wiring prop tên khớp đúng giữa 2 file.
- Chưa test tay trên UI thật (chưa chạy `npm run dev` để click thử) — cần sếp xác nhận trước khi commit.

### Result
History giờ có nút riêng để tải lại PDF hoá đơn TD Games bất kỳ lúc nào (không cần vào Edit), kèm popup cho chọn Light hoặc Dark Theme ngay lúc tải — độc lập với theme đã lưu của hoá đơn đó.

### Blockers
none

### Next Step
- Chưa commit — sếp test trên `npm run dev`: bấm icon mới (màu xanh sky, giữa Clone và eInvoice) trên 1 card History → chọn Light hoặc Dark → xác nhận in ra đúng bản PDF theo theme chọn, và tự quay lại History sau khi đóng dialog in.

---

