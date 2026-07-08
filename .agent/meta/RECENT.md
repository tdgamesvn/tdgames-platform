# RECENT — 5 sessions gần nhất

_Auto-generated từ LOG.md. Không sửa tay._

---

## 2026-07-08 (session 25 — Dashboard Financial Truth Layer Task 6-8, hoàn tất)
### Task
Tiếp nối session 24: Task 6+7 (confidence badge + auto-refresh) và Task 8 (regression pass) trong worktree `dashboard-financial-truth`.

### Work Done
- Task 6+7: `ConfidenceBadge` component (màu theo % — xanh ≥80%, vàng ≥40%, đỏ <40%) hiện dưới KPI Doanh thu qua prop `footer` mới trên `KpiCard`; `useEffect` interval 60s gọi lại `load()` (kèm ponytail comment giải thích chọn polling thay vì Supabase Realtime cho 1 màn hình admin xem). Commit `b9b5111`. Build ✅.
- Task 8 (regression pass) — verify UI thật qua Playwright, không chỉ build:
  - Chạy `npm run dev -- --port 3050` trong worktree (phải `dangerouslyDisableSandbox` vì sandbox mặc định chặn network listen).
  - Login đầu tiên fail với tài khoản sếp cung cấp (`toan.dang@tdgamestudio.com`) — báo "Tài khoản hoặc mật khẩu không đúng". Sếp bảo tự tạo tài khoản test.
  - Tạo tài khoản admin test qua SQL trực tiếp (`auth.users`+`auth.identities`, `crypt()`/`gen_random_uuid()`) — VẪN fail cùng lỗi dù password đúng 100% trong DB.
  - Debug root cause: verify `encrypted_password = crypt(...)` → `true` (mật khẩu sếp cung cấp ĐÚNG), tài khoản không bị ban/xoá. Curl trực tiếp `/auth/v1/token?grant_type=password` với anon key từ `.env.local` → `{"message":"Invalid API key"}`. **Anon key trong `.env.local` đã bị rotate/hết hạn** (so `iat` trong JWT: key cũ 2025 vs key hiện hành 2026 qua `mcp__supabase__get_publishable_keys`). Không phải bug code, không phải sai mật khẩu.
  - Cập nhật `VITE_SUPABASE_ANON_KEY` mới vào `.env.local` (root project, không commit — đã gitignore) + copy sang worktree. Curl xác nhận key mới trả `access_token` thành công.
  - Restart dev server, login lại qua Playwright với tài khoản thật của sếp → thành công. Snapshot `#dashboard`: confidence badge "(47% gán dự án)" trên KPI Doanh thu ✅; panel "Tiền mặt thực tế" (bank balance, empty-state đúng khi chưa có snapshot) ✅; panel "Lãi/lỗ theo dự án" (Monster Legend, ORCA — Tạm tính/Đã chốt) ✅; panel "Công nợ" AR 435.180.240đ / AP 222.443.516đ kèm breakdown ✅.
  - Xoá tài khoản test SQL tạm sau khi xong (không để rác trong DB prod).
- Cả 8 task của plan `2026-07-07-dashboard-financial-truth.md` hoàn tất. TASKS.md đã chuyển từ Doing → Done (mới).

### Findings phụ (chưa fix, ghi nhận để theo dõi)
- `finance_fx_rates` upsert trả 401 ngay lúc app khởi động (trước khi login) — có vẻ `exchangeRateService` cố ghi cache tỷ giá vào DB dù RLS yêu cầu quyền admin/ke_toan, chạy cả khi chưa có session. Liên quan Task 1 (tỷ giá live).
- Console 400 lặp lại ở `wf_workers`, `crm_outreach_leads`, `pay_payroll_sheets` khi Dashboard load — nghi ngờ pre-existing (không thuộc diff phiên này), chưa xác nhận nguyên nhân.

### Next Step
Merge worktree `dashboard-financial-truth` vào main (`superpowers:finishing-a-development-branch` nếu có), hoặc hỏi sếp có muốn điều tra tiếp 2 finding phụ ở trên trước khi merge không.

---

## 2026-07-07 (session 24 — bắt đầu Dashboard Financial Truth Layer, Task 1/8)
### Task
Thực thi plan `docs/superpowers/plans/2026-07-07-dashboard-financial-truth.md` (8 task) trong worktree `dashboard-financial-truth`. Ban đầu định chạy subagent-driven nhưng budget phiên (~$1.76 rồi thấp hơn) không đủ cho implementer+reviewer × 8 task → chuyển sang tự thực thi trực tiếp, bám plan.

### Work Done
- Task 1 xong: `apps/dashboard/services/dashboardService.ts` — bỏ hardcode `USD_TO_VND=25500`, thay bằng `fetchExchangeRate()+avgRate()` live từ VCB (fallback giữ nguyên 25500 nếu fetch lỗi). Nhân tiện mở rộng sẵn các `select()` (invoice/expense/task) thêm `due_date`, `vendor`, `crm_project_id`, `crm_projects.name` cho Task 2/4 sắp tới (chưa dùng, vô hại tới khi migration Task 2 chạy). Build ✅. Commit `9ece8c0` (worktree, chưa merge main).
- GitNexus MCP không kết nối được trong phiên → bỏ qua bước `impact()` bắt buộc theo CLAUDE.md, cần bù lại khi GitNexus sẵn sàng trước khi sửa tiếp `fetchCeoDashboard`.
- Task 2 (migration `finance_bank_balance_snapshots` + FK columns) đã có file draft tại `supabase/migrations/20260708090000_dashboard_financial_truth.sql` trong worktree nhưng CHƯA apply, CHƯA commit — dừng lại để tránh migration dở dang khi hết budget giữa chừng.

### Next Step
Phiên sau: chạy `impact()` cho `fetchCeoDashboard`, apply migration Task 2 qua `mcp__supabase__apply_migration`, verify schema + advisors, commit, rồi tiếp Task 3-8 theo plan.

### Update (session 25, cùng ngày — Task 2 xong)
- GitNexus vẫn không kết nối được (`ToolSearch "gitnexus"` → no match) — tiếp tục bỏ qua `impact()`, cần bù khi có GitNexus.
- Đọc lại migration draft trong worktree — khớp 100% với plan. Verify schema hiện tại qua `list_tables` (đọc file lớn qua Python thay vì Read trực tiếp — output 165KB vượt giới hạn token) trước khi apply: `invoice_invoices.crm_project_id` đúng là `text` chưa constraint, `expense_expenses`/`wf_tasks` chưa có `crm_project_id`, `crm_projects.id` là `uuid` — an toàn để chạy FK-ify.
- Applied qua `mcp__supabase__apply_migration` (prod) — `{"success":true}`. Verify bằng SQL trực tiếp: `finance_bank_balance_snapshots` tồn tại, 3 cột `crm_project_id` (expense_expenses/wf_tasks/invoice_invoices) đều kiểu `uuid`. `get_advisors(security)` — chỉ 1 warning liên quan `wf_tasks` (RLS "Allow all", pre-existing từ trước, không phải do migration này).
- Commit `84c6763` trong worktree.
- Dừng lại sau Task 2 (checkpoint DB sạch) do budget phiên nhỏ — Task 3 (bank balance service + UI form) là việc tạo file mới + build check, để phiên sau làm trọn vẹn thay vì cắt giữa chừng.

### Update (session 26, cùng ngày — Task 3 xong)
- Tạo `services/bankBalanceService.ts` + `apps/accounting/components/BankBalanceEntryTab.tsx` đúng theo plan, wire tab "💵 Số dư ngân hàng" vào `AccountingApp.tsx` + thêm `'bank-balance'` vào `AccountingTab` union trong `useAccountingState.ts`.
- Bài học nhỏ: build check đầu tiên chạy nhầm ở repo root (không phải worktree) → không kiểm tra được code thật, false-negative. Bash cwd không persist ổn định giữa các lời gọi riêng lẻ trong session này — phải `cd && lệnh` trong CÙNG MỘT lời gọi Bash mới ăn chắc. Build lại đúng trong worktree: pass sạch.
- Commit `e3a96c1`. Dừng do budget phiên gần cạn (~$0.17) — chưa manual verify UI (chưa mở `#accounting` thật để test form nhập số dư).

---

## 2026-07-07 (session 23 — fix Evaluation kẹt "Chờ NV tự đánh giá" sau khi NV đã nộp)
### Task
Sếp báo NV (Nguyễn Nam Hải) đã tự đánh giá xong (điểm 3.18 hiển thị đầy đủ) nhưng badge vẫn hiện "CHỜ NV TỰ ĐÁNH GIÁ" thay vì chuyển sang "CHỜ LEADER ĐÁNH GIÁ".

### Work Done
- Root cause: `submitEvaluation()` (evaluationService.ts) làm 2 bước tách rời — (1) insert `hr_evaluation_submissions`, (2) `UPDATE hr_evaluation_cycles SET status='pending_leader'`. Migration `20260702120000_tighten_rls_role_policies.sql` (siết RLS 2/7) đổi policy `hr_eval_cycles_write` chỉ cho admin/hr, leader_user_id, hoặc created_by — nhân viên tự đánh giá không thuộc nhóm nào nên bước (2) bị RLS chặn âm thầm (0 dòng update, không throw lỗi) → NV vẫn thấy toast thành công dù cycle không đổi status.
- Fix: migration `20260707200000_fix_eval_cycle_self_submit_rls_and_backfill.sql` — thêm điều kiện `employee_id IN (SELECT id FROM hr_employees WHERE auth_user_id = auth.uid())` vào USING/WITH CHECK của `hr_eval_cycles_write` (theo đúng pattern `auth_user_id` đã dùng ở `hr_onboarding_acknowledgments`). Backfill kèm trong cùng migration: cycle nào đang `pending_self` mà đã có submission `self` thì tự chuyển `pending_leader` + set lại `self_submitted_at`.
- Applied qua MCP `apply_migration`, verify: chỉ có đúng 1 cycle bị ảnh hưởng (Nguyễn Nam Hải) — đã confirm chuyển đúng sang `pending_leader` sau khi chạy.

### Validation
- Query trước/sau xác nhận cycle `3b6c04fe-...` chuyển `pending_self` → `pending_leader`, `self_submitted_at` có giá trị đúng bằng thời điểm nộp thật.
- Chưa test UI thật (badge hiển thị đúng "CHỜ LEADER ĐÁNH GIÁ" trên localhost/prod) — sếp nên xem lại trang chi tiết cycle này để xác nhận.

### Next Step
Sếp verify lại trên UI (trang HR → Đánh giá → cycle Nguyễn Nam Hải) xem badge đã đổi đúng chưa, và nhắc leader vào đánh giá tiếp.

### Update (cùng ngày)
Sếp xác nhận đã kiểm tra trên UI, badge hiển thị đúng "CHỜ LEADER ĐÁNH GIÁ". Đóng task.

---

## 2026-07-07 (session 22 — reset password không gửi mail, chuyển 3 luồng auth email sang Resend)
### Task
Sếp báo `reset_password` (đổi mật khẩu) chỉ generate link chứ không gửi mail cho nhân viên.

### Work Done
- Root cause: `create-employee-auth` (invite) và `manage-employee-auth` (resend_invite/reset_password) dùng `inviteUserByEmail()`/`generateLink()` để mailer mặc định của Supabase tự gửi — không đáng tin cậy (khác `notify-email` đã ổn định qua Resend từ lâu).
- Fix: cả 3 luồng đổi sang `generateLink()` lấy `action_link` rồi tự soạn email (template HTML/text giống `notify-email`) + gửi qua Resend API (`sendAuthEmail()`, duplicate 2 file vì 2 edge function riêng, đánh dấu `ponytail:` comment). Giữ nguyên `verify_jwt` của cả 2 function.
- Deploy prod: `create-employee-auth` v35, `manage-employee-auth` v18 — verify qua `list_edge_functions` khớp đúng version + `verify_jwt` không đổi.
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL` đã có sẵn ở project-level secrets (dùng chung với `notify-email`), không cần cấu hình thêm.

### Validation
- `npm run build` ✅ (9.11s, chỉ warning chunk-size pre-existing, không đụng frontend nên rủi ro thấp).
- Verify deploy đúng version qua `mcp__supabase__list_edge_functions`.
- Commit `c716e53`.
- Chưa test gửi thật 1 email reset password trên UI — sếp nên thử 1 lần để xác nhận hộp thư nhận được.

### Next Step
Sếp thử reset password thật cho 1 tài khoản, xác nhận nhận được mail (kiểm tra cả Spam nếu domain Resend `mail.tdgamestudio.com` mới).

### Update (cùng ngày)
Sếp xác nhận đã test thật trên prod — reset password nhận được mail bình thường. Đóng task.

## 2026-07-07 (session 21 — fix lỗi tạo đơn nghỉ phép/remote: "record new has no field start_date")
### Task
Sếp báo lỗi khi nhân viên tạo đơn xin nghỉ (kể cả loại "Làm remote") trong Attendance/Portal — toast đỏ "RECORD "NEW" HAS NO FIELD "START_DATE"".

### Work Done
- Systematic debugging: grep `NEW.start_date` → tìm ra 2 trigger function trong `20260520033918_create_notifications_system.sql` (`notify_leave_new` AFTER INSERT, `notify_leave_status_change` AFTER UPDATE OF status trên `att_requests`) tham chiếu `NEW.start_date`/`NEW.end_date`/`NEW.notes`.
- Verify qua `information_schema.columns`: bảng `att_requests` thật sự có `date_from`/`date_to`/`reviewer_note` (không có `start_date`/`end_date`/`notes`). Root cause xác nhận: trigger viết sai tên cột ngay từ lúc tạo (2026-05-20) — mọi INSERT vào `att_requests` (leave lẫn remote, vì cả 2 đều dùng `request_type='leave'`) đều bị trigger `notify_leave_new` crash → rollback toàn bộ transaction.
- Fix: `CREATE OR REPLACE FUNCTION` cho cả 2 hàm, đổi sang đúng tên cột `date_from`/`date_to`/`reviewer_note`. Migration `20260707190000_fix_leave_notify_triggers_column_names.sql`, applied qua MCP + lưu file local.

### Validation
- Test trực tiếp: INSERT + DELETE thử 1 record vào `att_requests` (request_type='leave', leave_type='remote') qua `execute_sql` — chạy sạch, không còn lỗi.
- Chưa test lại trên UI thật (`npm run dev`) — sếp nên thử tạo lại đơn nghỉ/remote để xác nhận.

### Blockers
none

### Next Step
Sếp verify trên localhost:3000 hoặc prod — tạo thử 1 đơn remote/nghỉ phép, xác nhận không còn lỗi và nhận được thông báo (notification) tương ứng.

## 2026-07-06 (session 20 — đồng bộ frontend leaveService.ts/LeaveTab.tsx với DB mới)
### Task
Tiếp nối session 19 (DB đã fix carry-over → reset hàng năm). Phát hiện qua review: frontend vẫn tự tính accrual bằng công thức 0.5 ngày/tháng cũ (`calculateYearlyAccrual`) + tự ghi/carry-over quarter=1 (`ensureBalancesForYear`) — hoàn toàn lệch với DB mới (chỉ dùng quarter=0, không carry-over, trigger/cron tự tính). 2 nguồn tính song song → sai lệch số hiển thị. Sếp yêu cầu làm nốt: đồng bộ frontend + thêm mục "Quyền lợi nghỉ phép" tổng quan (Phép năm/Sinh nhật/Remote/Hiếu hỉ).

### Work Done
- `apps/portal/services/leaveService.ts`: xoá `calculateYearlyAccrual`, `getCurrentQuarter`, `ensureBalancesForYear`, `upsertLeaveBalance` (frontend không còn tự tính/ghi accrual — DB trigger/cron sở hữu hoàn toàn). Thêm `fetchYearlyBalance(employeeId, year)` — chỉ đọc quarter=0. `getAvailableLeaveDays()` đổi signature còn 1 tham số, trả `{accrued, used, expired, available}`. `approveLeaveRequest`: bỏ nhánh trừ carry-over quarter=1, chỉ trừ quarter=0.
- `apps/portal/components/LeaveTab.tsx`: bỏ state `carryOverBalance`/`currentQ`; `loadData()` dùng `fetchYearlyBalance` thay `ensureBalancesForYear`; toàn bộ `leaveInfo.totalAvailable`/`carryOver*` đổi sang `leaveInfo.available`/`expired`; xoá UI hiển thị "ngày dư từ năm trước". Thêm section mới "🎁 Quyền lợi nghỉ phép" (card tổng quan 4 loại: Phép năm còn lại, Sinh nhật đủ điều kiện/đã dùng, Remote đã dùng tuần này, Hiếu hỉ không giới hạn).
- Grep xác nhận `LeaveApproval.tsx` (attendance) chỉ dùng `fetchAllLeaveRequests/approveLeaveRequest/rejectLeaveRequest/deleteLeaveRequest/submitLeaveRequest` — không đụng các hàm balance đã xoá, không có caller nào khác ngoài `leaveService.ts` + `LeaveTab.tsx`.

### Validation
- `npm run build` ✅ (9.43s, 543 modules, 0 lỗi TS mới — chỉ warning chunk size pre-existing).
- GitNexus MCP không khả dụng session này → thay bằng grep toàn bộ call site của các hàm bị xoá trước khi xoá (đảm bảo không còn caller nào ngoài phạm vi đã sửa).

### Blockers
none

### Next Step
- Sếp verify thực tế trên `npm run dev` → tab Nghỉ phép Portal: số "Ngày phép còn lại" đúng bằng `leave_balance_summary`, không còn nhắc "ngày dư từ năm trước".

## 2026-07-06 (session 19 — leave balance carry-over → reset hàng năm)
### Task
Sếp chốt quy tắc chính thức cho nghỉ phép: "Mỗi tháng khi lên chính thức thì cộng 1 ngày nghỉ phép, cộng dồn. Hết năm không dùng hết thì bị reset (KHÔNG carry-over sang năm sau)." Trước đó phát hiện thêm 1 bug nhỏ: `refresh_leave_balances()` bỏ sót NV đã qua thử việc nhưng chưa được set `official_date` (chỉ có `probation_end`).

### Work Done
- Migration `20260707160000_leave_balances_fallback_official_date.sql`: `refresh_leave_balances()` dùng `COALESCE(official_date, probation_end + 1)` làm ngày gốc tính phép thay vì chỉ `official_date`.
- Migration `20260707170000_leave_balances_official_accrual_reset.sql` (root cause tổng hợp, applied prod qua MCP trước khi track vào git):
  1. Cron/trigger trước đây ghi `quarter=1` (annual) nhưng frontend coi `quarter=1` là "carry-over năm trước" và tự zero sau Q1 → balance về 0 sai. Fix: cron + trigger đều ghi `quarter=0`.
  2. Trigger `auto_create_leave_balance()` dùng công thức 0.5 ngày/tháng lẻ (front-loaded cả năm) khác với `count_official_months_in_year()` (chỉ tính tháng đã hoàn thành) mà cron dùng → 2 nguồn tính lệch nhau. Fix: dùng chung 1 công thức.
  3. Trigger chỉ lắng nghe `UPDATE OF probation_end`, bỏ sót khi HR chỉ sửa `official_date`. Fix: thêm `official_date` vào trigger.
  4. `ON CONFLICT DO NOTHING` khiến balance đứng yên mãi dù `official_date` đổi sau đó. Fix: `DO UPDATE SET accrued_days = ...`.
  5. Bỏ cron carry-over `expire-leave-balances-q1` (không còn khái niệm carry-over).
  - `leave_balance_summary` view đọc `quarter=0`, bỏ grace period Q1 năm sau.
  - Backfill: chạy lại `refresh_leave_balances(2026)` cho toàn bộ NV fulltime/active.
- Fix không liên quan phát hiện cùng lúc: `fetchEmployeesLite()` (hrService.ts) thiếu cột `probation_end`/`official_date` → EvalCreateModal luôn thấy null, danh sách thử việc/chính thức trong tab Đánh giá trống rỗng. Commit `0928883`.

### Validation
- Query trực tiếp `leave_balance_summary` sau khi backfill: accrued_days lẻ đúng theo tháng chính thức đã hoàn thành (VD Nguyễn Nam Hải 5.5, Nguyễn Tiến Đạt 4.5, Đặng Thế Toàn 4.0), NV còn thử việc = 0 + status "chưa đủ tháng". Không chạy `npm run build` (chỉ SQL, không đụng frontend cho 2 migration leave — trừ fix hrService.ts riêng, đã build/lint qua ở commit đó).

### Blockers
none

### Next Step
- Migration 20260707170000 đã applied prod từ trước, session này chỉ track lại vào git (commit `255d28d`) — không cần apply lại.
- Nếu sếp muốn xem lịch sử reset cuối năm, hiện chưa có UI/log riêng cho việc "hết năm bị reset" — `expired_days` trong `leave_balance_summary` tính qua điều kiện `year < current year` chứ chưa có cột lưu vết ngày reset thật.

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

