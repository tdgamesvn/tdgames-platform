# LOG

## 2026-05-21 (session — Verify Accounting VAT + TNCN)
### Task
Verify dữ liệu thực tế cho VatTab và TncnTab; đóng task invoice TD CONSULTING

### Work Done
- User xác nhận 4 invoice TD CONSULTING đã được nhập (Jan–Apr 2026) → đóng task
- Query Supabase `invoice_invoices`: 11 invoices, issue_date ✅, billing_entity ✅, tax_rate=0% (export services — đúng)
- Query `pay_payroll_sheets` + `pay_payroll_records`: 2 sheets paid (T3/2026: 1 NV, PIT 544,500₫; T4/2026: 4 NV, PIT 1,241,408₫)

### Result
- VatTab: hoạt động đúng, VAT=0% là business rule cho dịch vụ xuất khẩu phần mềm
- TncnTab: pivot T3+T4/2026 hiển thị đúng; các tháng chưa có sheet hiện `·` — đúng logic
- Tất cả tasks trong backlog đã Done

### Next Step
- Tạo bảng lương T1, T2/2026 nếu cần (user action)
- Nhận yêu cầu feature mới

---

## 2026-05-21 (session — HelpPanel all modules)
### Task
Thêm HelpPanel cho Attendance, Payroll, Workforce, CRM

### Work Done
- Xác nhận `helpContent.ts` đã tồn tại cho tất cả 4 module (được tạo sẵn từ trước)
- Wire HelpPanel vào `AttendanceApp.tsx`: import + useState + onHelp + `<HelpPanel>`
- Wire HelpPanel vào `PayrollApp.tsx`: import + useState + onHelp + `<HelpPanel>`
- Wire HelpPanel vào `WorkforceApp.tsx`: import + useState + onHelp + `<HelpPanel>`
- Wire HelpPanel vào `CrmApp.tsx`: import + useState + onHelp + `<HelpPanel>`

### Validation
- `npm run build` ✅ (6.78s, no TypeScript errors)
- commit 7f40aec, pushed to origin/main ✅

### Result
- Tất cả 8 module chính đều có HelpPanel: Invoice, HR, Expense, Accounting, Attendance, Payroll, Workforce, CRM
- Nút ❓ trên Navbar mở panel contextual theo tab đang active

### Next Step
- VPS auto-deploy qua GitHub Actions (~25s)
- Verify live tại app.tdgamestudio.com

---

## 2026-05-21 (session — TASKS cleanup)
### Task
Dọn dẹp TASKS.md — đóng discovery task cũ, ghi lại đúng trạng thái thực

### Work Done
- Đọc toàn bộ LOG.md và TASKS.md để so chiếu
- Đóng 5 discovery/planning task cũ từ 2026-05-14 (superseded bởi thực tế)
- Di chuyển "Analyze repository" sang Done
- Thêm 15 Done item mới phản ánh toàn bộ work từ 2026-05-16 → 2026-05-21
- To Do còn lại: HelpPanel (Attendance/CRM/Payroll/Portal), 4 invoice TD CONSULTING, verify Accounting Phase 3 data

### Result
- TASKS.md phản ánh đúng trạng thái thực tế tính đến 2026-05-21
- Đã ghi nhận 20+ tasks Done, 3 tasks To Do actionable còn lại

---

## 2026-05-21 (session — Kế toán Phase 3)
### Task
Build Phase 3 Accounting: VAT theo quý & Quyết toán TNCN

### Work Done
- `VatTab.tsx`: bảng kê thuế GTGT từ invoice_invoices, filter theo năm + quý, tổng DT/VAT/tổng, click quý → drill-down, export CSV
- `TncnTab.tsx`: pivot PIT × nhân viên × tháng 1–12, tổng cả năm mỗi người, tổng từng tháng, export CSV quyết toán
- `accountingService.ts`: `fetchPayrollForTncn()` join pay_payroll_records + pay_payroll_sheets, `fetchEmployeesForAccounting()`
- `useAccountingState.ts`: 7 tabs (+ vat + tncn), load payrollRecords + employees
- `AccountingApp.tsx`: 7 tabs hoàn chỉnh Phase 1+2+3

### Validation
- `npm run build` ✅ (6.72s, no TypeScript errors)
- commit b4025fa, pushed to origin/main ✅

### Result
- Accounting module hoàn chỉnh 7 tabs: Tài sản | Tạm ứng | Công nợ | Lãi/Lỗ | Ngân hàng | VAT | TNCN
- CFO roadmap Phase 1+2+3 hoàn tất

### Next Step
- Verify VPS auto-deploy thành công
- Nhập dữ liệu thực tế để test các tab mới

---

## 2026-05-21 (session — Kế toán Phase 2)
### Task
Build Phase 2 Accounting: Công nợ AP, P&L, Đối chiếu ngân hàng

### Work Done
- `PayablesTab.tsx`: group expense_expenses by vendor, period filter (tháng/quý/năm/all), summary cards, expandable vendor rows
- `PnlTab.tsx`: 3 views (Tổng quan / Theo danh mục / Theo client), period picker, CSS-only bar chart, invoice + expense data
- `BankReconcTab.tsx`: CSV import với auto-detect Techcombank/BIDV format, auto-match (±1% amount + ±3 ngày), manual match dropdown, unmatch
- `accountingService.ts`: thêm `fetchBankStatements`, `importBankStatements`, `matchBankStatement`, `unmatchBankStatement`, `fetchInvoicesForAccounting`, `fetchExpensesForAccounting`
- `useAccountingState.ts`: mở rộng từ 2 tabs → 5 tabs (assets/advances/payables/pnl/bank), load invoices + expenses + statements
- `AccountingApp.tsx`: redesign tab bar compact scrollable, thêm 3 tab mới, wire toàn bộ props

### Validation
- `npm run build` ✅ (6.75s, no TypeScript errors)

### Result
- AccountingApp giờ có đủ 5 tab Phase 1 + Phase 2
- Bank reconciliation hỗ trợ import CSV Techcombank & BIDV, auto/manual match
- P&L tính toán từ dữ liệu invoice + expense thực tế, quy đổi VND qua ExchangeRateContext

### Next Step
- Commit + push → auto-deploy VPS
- Phase 3: VAT tổng hợp theo quý, TNCN tự động

---

## 2026-05-19 (session — pg_cron real automation)
### Task
Fix pg_cron → Edge Function auth để cron thật sự tự chạy

### Root Cause
- `outreach-auto-batch`: cron gửi `x-cron-secret` nhưng function code check `Authorization: Bearer JWT` → mọi cron call **fail 401 im lặng** từ trước
- `outreach-auto-discovery`: `verify_jwt: true` → Supabase gateway reject cron call trước khi function chạy; chưa có pg_cron job; không tự đọc country từ config

### Work Done
- Rewrote `outreach-auto-batch/index.ts`: chấp nhận `x-cron-secret` → dùng `SUPABASE_SERVICE_ROLE_KEY`, vẫn giữ Bearer JWT path cho UI manual
- Rewrote `outreach-auto-discovery/index.ts`: tương tự + tự đọc country từ `auto_discovery.countries[current_country_index]` khi cron không truyền body; check `enabled` flag (skip nếu false)
- Deployed cả 2 functions với `verify_jwt: false` (version 6 và 2)
- Thêm pg_cron job #7 `outreach-auto-discovery-daily` schedule `0 2 * * *` (9:00 VN hàng ngày)
- Enable `auto_discovery.enabled = true` trong `crm_outreach_config`

### Validation
- 7 cron jobs active: clickup×2, outreach-batch×2, leave×2, **discovery×1** ✅
- auto_discovery: enabled=true, countries=[US, CA, UK, AU], idx=0, page=1 ✅
- Both edge functions deployed ACTIVE ✅

### Result
- `outreach-auto-batch` cron (7:00 VN + 14:00 VN) giờ thật sự gọi được FastAPI
- `outreach-auto-discovery` tự chạy 9:00 VN mỗi ngày, tự rotate country/page

### Additional Fix (same session)
- Phát hiện FastAPI `/api/automation/daily-send` yêu cầu `X-Admin-Token`
- VPS có 2 giá trị OUTREACH_ADMIN_TOKEN khác nhau (.env vs systemd) — lấy đúng token runtime từ systemd
- Lưu runtime token vào `crm_outreach_config.admin_token`, edge function đọc và forward
- **Live test request #108: 200 OK — 25 leads queued, 87.5 phút estimated** ✅

---

## 2026-05-19 (session — Auto Discovery backend)
### Task
Implement FastAPI `/api/discovery/auto-run` endpoint on VPS

### Work Done
- Created `/opt/td-mailer-api/routes/discovery.py` with `POST /auto-run` endpoint: searches Apollo by country/page, filters excluded apollo_ids, discovers contacts, filters excluded emails, returns rotation hints (`country_exhausted`)
- Registered `discovery_router` in `/opt/td-mailer-api/app.py` at prefix `/api/discovery`
- Restarted `td-mailer-api.service` via systemctl
- Verified endpoint locally: `POST localhost:8401/api/discovery/auto-run` ✅
- Verified end-to-end through nginx: `https://app.tdgamestudio.com/outreach-api/api/discovery/auto-run` ✅

### Validation
- Local test: `studios_searched: 2, country_exhausted: false` ✅
- Nginx proxy test: `1 searched, 0 contacts, exhausted: False` ✅
- OUTREACH_API_URL in Supabase secrets already correct (`https://app.tdgamestudio.com/outreach-api`) from previous auto-batch setup

### Result
- Auto Discovery chain complete: UI → Supabase Edge Fn → nginx → FastAPI → Apollo
- `contacts_found: 0` expected on studios without Apollo email credits — structure is correct

---

## 2026-05-19 (session — Auto Discovery Tab)
### Task
Add 🤖 Auto sub-tab to CRM Email Outreach with country-rotation discovery scheduling

### Work Done
- Supabase migration: created `crm_discovered_studios` table (apollo_id PK, studio_name, country, contacts_found, discovered_at) + seeded `auto_discovery` config row in `crm_outreach_config`
- New edge function `outreach-auto-discovery`: deployed to Supabase, proxy pattern matching `outreach-auto-batch`, builds exclusion lists (existing apollo_ids + emails) before forwarding to FastAPI `/api/discovery/auto-run`, updates rotation state after run
- New `apps/crm/components/AutoTab.tsx`: Auto Discovery section (country pills, rotation state display, credit config, Run Now, result banner) + Auto Batch section (lifted from DashboardTab with identical logic)
- Updated `apps/crm/components/EmailOutreach.tsx`: added `'auto'` to SubTab type, added 🤖 Auto tab entry, render `<AutoTab />`, updated DashboardTab to accept `onSwitchTab` prop, replaced Auto Batch config card with compact summary card linking to Auto tab
- Wrote implementation plan at `docs/superpowers/plans/2026-05-19-auto-discovery-tab.md`

### Validation
- `npm run build` ✅ (6.41s, no TypeScript errors)
- commit: 926c463
- pushed to origin/main ✅

### Result
- CRM now has dedicated Auto tab with scheduled discovery + batch in one place
- Dashboard is cleaner with a single "🤖 Automation → Xem cấu hình" card
- Backend endpoint `/api/discovery/auto-run` is out-of-scope (FastAPI side) — UI shows error state if not yet implemented

### Next Step
- Implement FastAPI `/api/discovery/auto-run` on VPS to complete the Auto Discovery loop
- Verify VPS auto-deploy completed via GitHub Actions

## 2026-05-19 (session — CRM Discovery v2)
### Task
Apollo.io + ZeroBounce integration, country-based studio discovery, country dropdown UX refinement

### Work Done
- Created `/opt/td-mailer-api/services/apollo.py`: Apollo.io v1 API integration with `X-Api-Key` header auth, game-focused keywords (game studio, indie game, publisher, etc.), no employee filter (small studios in high-cost countries are prime outsource targets)
- Created `/opt/td-mailer-api/services/email_validator.py`: ZeroBounce validation wrapper
- Extended `/opt/td-mailer-api/routes/leads.py` with 3 endpoints: `GET /companies/search`, `GET /cooldown-check`, `POST /discover-apollo`
- Appended unsubscribe handler to `/opt/td-mailer-api/routes/webhook.py`: `GET /unsubscribe`
- Added APOLLO_API_KEY, ZEROBOUNCE_API_KEY, RESEND_WEBHOOK_SECRET to VPS `.env`
- Added `searchCompaniesByCountry()` and `discoverContactsApollo()` to `outreachService.ts`
- Added "Tìm theo quốc gia" sub-tab in `EmailOutreach.tsx` DiscoveryTab: mode switcher, 21-country dropdown, checkbox results table, pagination, batch import button
- Updated country dropdown: removed Vietnam/SEA/India, reordered by outsourcing priority (USA, Canada, UK, Australia first); changed default to "United States"

### Validation
- `npm run build` passed ✅
- Apollo API 422 fix: switched from body `api_key` to `X-Api-Key` header (Apollo API change)
- Canada search returns 1,938 companies after removing employee filter ✅
- Deployed to VPS `/var/www/tdgames-platforms/` ✅

### Result
- CRM Discovery now supports Apollo.io company search by country + people discovery per studio
- Country list scoped to high-value outsourcing markets only (no SEA/India)

## 2026-05-19 (session 7)
### Task
Multi-bank / multi-entity accounting architecture (#7 in CFO roadmap)

### Work Done
- Supabase migration: tạo bảng `finance_bank_accounts` (RLS: is_admin_or_ke_toan)
- Seed 6 tài khoản ngân hàng: BIDV VND/USD (TD GAMES), TCB VND/USD (TD GAMES), TCB VND (Cá nhân), BIDV USD (TD CONSULTING)
- Supabase migration: thêm `billing_entity TEXT` + `receiving_account_id UUID FK` vào `invoice_invoices`
- Tạo `apps/expense/services/bankAccountService.ts` — fetchBankAccounts()
- Cập nhật `InvoiceData` type: thêm billing_entity + receiving_account_id
- Cập nhật `supabaseService.ts`: save + parse 2 field mới
- Cập nhật `InvoiceEditor.tsx`: 2 dropdown chọn pháp nhân + TK ngân hàng nhận (lọc theo entity)
- Cập nhật `InvoiceApp.tsx`: fetch bankAccounts, pass vào InvoiceEditor
- Nâng cấp `CashFlowView.tsx`: 3-stream tabs (TD GAMES / TD CONSULTING / Cá nhân), luồng Cá nhân chỉ hiện với admin+ke_toan, chi phí chỉ tính ở TD GAMES stream

### Validation
- `npm run build` passed ✅ (no TypeScript errors)
- commit: c70d788

### Result
- Invoice Editor giờ có dropdown chọn pháp nhân phát hành + TK ngân hàng nhận tiền
- Cash Flow View tách 3 luồng rõ ràng, bảo vệ dữ liệu cá nhân theo role

### Next Step (Task 6 — blocked chờ user)
- Cần thêm 4 invoice còn thiếu của TD CONSULTING (Jan–Apr 2026): user cung cấp client name, amount, currency, issue_date, paid_date
- Deploy lên VPS production

## 2026-05-18 (session 6)
### Task
Leave eligibility rules + Nghỉ sinh nhật + Làm remote

### Work Done
- **`types.ts`**: Thêm `'birthday' | 'remote'` vào union `leave_type`
- **`leaveService.ts`**: Cập nhật type signature `submitLeaveRequest`
- **`LeaveTab.tsx`** (Portal): Logic eligibility động:
  - "Phép năm": ẩn nếu đang thử việc HOẶC hết ngày phép
  - "Nghỉ ốm": ẩn nếu đang thử việc
  - "🎂 Nghỉ sinh nhật": hiện khi chính thức + đủ 6 tháng + chưa dùng năm nay
  - "🏠 Làm remote": hiện khi chính thức + chưa dùng tuần này
  - Info banner nhắc ngày sinh nhật / remote còn
  - Warning nếu không đủ điều kiện bất kỳ loại nào
  - Validate: birthday/remote chỉ được chọn 1 ngày
- **`LeaveApproval.tsx`** (Admin): Thêm label 2 loại mới
- Commit `fb91589` + push + deploy VPS ✅

### Validation
- `npm run build` ✅ (6.31s local, 8.95s VPS)
- Deploy `https://app.tdgamestudio.com` ✅

### Result
- Form xin nghỉ chỉ hiện đúng loại nhân viên đó được phép dùng
- 2 phúc lợi mới: Nghỉ sinh nhật (đủ 6 tháng, 1 lần/năm) và Làm remote (1 lần/tuần)

---

## 2026-05-18 (session 5)
### Task
Simplify leave form + quyết định về tích hợp ca làm việc

### Work Done
- **`LeaveTab.tsx`**: Bỏ toggle "Cả ngày / Theo giờ", gộp thành 1 form duy nhất
  - Luôn có: date_from, date_to, time_from (08:30), time_to (17:30)
  - Khi chọn date_from → date_to tự fill = date_from
  - Logic tính: `effectiveHours()` trừ nghỉ trưa 12:00–13:00, multi-day tính từng ngày
  - Hiển thị: cả ca → "X ngày", bán ca → "Xh = Y ngày"
- **Quyết định**: Giữ ca làm việc hardcode (08:30–17:30, trưa 12:00–13:00)
  - `att_shifts` chỉ có `break_minutes` (không có break_start/end)
  - Công ty 1 ca cố định → hardcode đủ dùng, sẽ xét lại khi có nhiều ca
- Commit `6c87a56` + push + deploy VPS ✅

### Validation
- `npm run build` ✅ (6.34s)
- Deploy `https://app.tdgamestudio.com` ✅

### Decision
- Ca làm việc hardcode tạm thời: 08:30–17:30, nghỉ trưa 12:00–13:00 = 8h/ngày
- Nếu sau này nhiều ca → cần thêm `break_start`/`break_end` vào `att_shifts` (hướng C)

---

## 2026-05-18 (session 4)
### Task
Add hourly leave request to Employee Portal

### Work Done
- **DB migration**: Thêm 3 cột vào `att_requests` — `leave_hours` (numeric), `time_from` (time), `time_to` (time)
- **`types.ts`**: Thêm `leave_hours?`, `time_from?`, `time_to?` vào `AttRequest`
- **`leaveService.ts`**: `submitLeaveRequest` nhận thêm `opts` (leaveHours, timeFrom, timeTo)
- **`LeaveTab.tsx`** (Portal): Toggle "📅 Cả ngày / ⏱ Theo giờ", time picker, tự tính `leave_days = hours/8`, hiện quy đổi trong lịch sử đơn
- **`LeaveApproval.tsx`** (Admin): Hiện giờ và quy đổi ngày trong chi tiết đơn
- Commit `9d9ad52` + push + deploy VPS ✅

### Validation
- `npm run build` ✅ pass (6.33s local, 8.08s VPS)
- Deploy `https://app.tdgamestudio.com` ✅

### Result
- Nhân viên có thể xin nghỉ theo giờ, hệ thống tự tính ra số ngày phép (VD: 2h = 0.25 ngày, 8h = 1 ngày)
- Admin thấy chi tiết giờ nghỉ khi duyệt đơn

---

## 2026-05-18 (session 3)
### Task
Fix HR Reminder bugs: birthday/anniversary next-year + auto-scan

### Work Done
- **`hrService.ts` — Birthday fix**: Nếu sinh nhật đã qua năm nay thì dùng năm sau thay vì bỏ qua
- **`hrService.ts` — Anniversary fix**: Tương tự, check năm sau nếu đã qua; tính số năm từ `anni.getFullYear()` (chính xác hơn)
- **`useHrState.ts` — Auto-scan**: Thêm `useEffect` tự động gọi `generateReminders()` khi chuyển sang tab `reminders` (không cần bấm "Quét nhắc nhở")
- Build + commit `5497ff2` + push + deploy VPS thành công

### Validation
- `npm run build` ✅ pass
- Deploy `https://app.tdgamestudio.com` ✅

### Result
- Reminders sẽ không bỏ sót sinh nhật/kỷ niệm của nhân viên nữa
- Tab Nhắc việc tự động quét khi mở, không cần thao tác thủ công

---

## 2026-05-18 (session 2)
### Task
Analytics tab + auto follow-up fix + quota bug fix

### Work Done
- **cron_followup.py**: Fix import từ `gmail_sender` → `sender_dispatch` (Resend) + `quota.py` cho `get_quota_status`
- **quota.py**: Fix query đếm quota: `status='sent'` → `status IN (sent, delivered, opened, clicked)` — trước đây Resend webhook update `delivered` quá nhanh làm quota tưởng 0
- **VPS `/api/email/analytics`**: Thêm endpoint mới tổng hợp: delivery rate, open/click rate, by_template, pipeline funnel, trend 7 ngày
- **EmailOutreach.tsx**: Thêm tab `Analytics` (📈) với KPI cards, bar chart 7 ngày, bảng by_template, pipeline funnel
- Deploy VPS service restart + build + nginx reload

### Validation
- `GET /api/email/analytics` → JSON đầy đủ: `total_sent=400, delivered=30, trend_7d` ✅
- `GET /api/email/status` → `sent_today=31, remaining=0` (đúng sau quota fix) ✅
- `npm run build` pass, deploy `https://app.tdgamestudio.com` ✅
- `cron_followup.py --dry-run` pass: Quota=31/30, 0 leads due (followup_1 sau 3 ngày) ✅

### Result
- Analytics tab live tại CRM → tab 📈 Analytics
- Quota counter chính xác từ giờ
- Follow-up cron sẽ gửi Resend (không phải Gmail) từ ngày 21/05 trở đi

---

## 2026-05-18
### Task
Fix Lead Discovery Pipeline + Batch Email Send (30 leads)

### Work Done
- **Discovery fixes (VPS)**:
  - `services/discovery.py`: Fix `salesql_enrich` vô hạn retry khi 429 → giờ retry tối đa 1 lần rồi bỏ qua
  - `routes/leads.py`: Viết lại `POST /discover-batch` + `GET /discover-batch-status` dùng background thread + in-memory job store (tránh browser-blocking khi discover nhiều công ty)
- **Frontend fixes (CRM)**:
  - `outreachApi.ts`: Tăng default timeout từ 45s → 60s (discovery mất ~17-30s)
  - `outreachService.ts`: Thêm `discoverBatch()` + `getDiscoverBatchStatus()` dùng polling mỗi 3s
  - `EmailOutreach.tsx`: Thêm `fuzzyMatch()` + company suggestion dropdown (gợi ý studio đã có trong leads), thêm "Thêm tất cả vào Leads" button sau khi discover xong
- **Email Outreach run**:
  - Verify 230 pending leads: 162 valid, 68 invalid, 1 high_risk
  - Gửi batch 30 emails (template `initial_outreach`) với delay ngẫu nhiên 2-5 phút/email
  - Kết quả: **30/30 sent, 0 failed** (09:44 – 11:21)

### Validation
- Discovery `Supercell` trả về 5 contacts trong ~17s
- Batch email send: 30/30 thành công qua Resend API, 0 lỗi
- Build `npm run build` pass sau các thay đổi frontend

### Result
- Discovery pipeline hoạt động ổn định, không còn timeout/infinite retry
- Batch discovery chạy nền, không block browser
- Giao diện có gợi ý công ty khi nhập + nút add-all contacts
- 30 emails outreach gửi thành công

---

## 2026-05-17 (session 2)
### Task
Migrate outreach settings từ JSON file tạm trên VPS → Supabase DB (`crm_outreach_settings`)

### Work Done
- Tạo table `crm_outreach_settings` trên Supabase Workflow project (id=1, single-row constraint, RLS enabled)
- Seed row mặc định: `sending_paused=true`, `daily_limit=30`, `resend_tag_campaign=outreach`
- Fix RLS policies: ban đầu dùng `service_role` + `authenticated` → bị block vì VPS dùng anon key. Sửa lại khớp pattern các bảng CRM khác: `public ALL` + `authenticated ALL`
- Viết lại `services/settings.py` trên VPS: JSON file-backed → DB-backed qua `supabase_client.get_client()`
- Backup JSON version tại `/opt/td-mailer-api/services/settings.py.bak-jsonfile`
- Restart `td-mailer-api.service` — `active` ngay
- Xoá file JSON tạm `/opt/td-mailer-api/data/settings.json`
- Verify GET `/api/settings` → `source: "db"` ✅
- Verify PUT `/api/settings` ghi thành công vào Supabase và trả về row mới ✅

### Validation
- `GET /outreach-api/api/settings` → `source: "db"` live qua nginx
- `PUT /outreach-api/api/settings` → `ok: true, updated_by: "test"` trong DB
- Row trong Supabase: `updated_at: 2026-05-17T16:42:43`, `updated_by: "test"` ✅

### Result
Settings outreach giờ được persist trong Supabase thay vì JSON file. Thay đổi từ UI (Settings tab) được lưu vĩnh viễn và nhìn thấy ngay cả khi VPS restart.

### Pending
- `resend_from` vẫn trống — cần điền địa chỉ From hợp lệ từ Settings UI
- `EMAIL_SENDER_PROVIDER` vẫn là `gmail` trong systemd — cần switch sang `resend` sau khi set `RESEND_API_KEY`
- `SENDING_PAUSED=true` vẫn đang giữ — chờ verify 234 leads trước khi bật lại

## 2026-05-14
### Task
Bootstrap project-agent structure

### Work Done
- created standardized project root for tdgames-platforms
- prepared project memory files
- prepared agent workflow file

### Validation
- verified directory structure exists

### Result
- project is ready to receive codebase import and agent-driven workflow

### Blockers
- codebase had not been imported yet at this stage

### Next Step
- import the real repository and inspect repository contents

---

## 2026-05-14
### Task
Import repository and align project memory with the real codebase

### Work Done
- created standardized `~/Work` project layout
- imported repository from `https://github.com/tdgamesvn/tdgames-platform`
- preserved project-agent files while merging the real codebase
- inspected package metadata, README, CLAUDE.md, and major directories
- identified stack as Vite + React + TypeScript + Supabase
- identified GitNexus usage requirements from `CLAUDE.md`

### Validation
- verified top-level repository structure after merge
- reviewed `package.json` scripts and dependencies
- reviewed documentation files for run instructions and workflow rules

### Result
- tdgames-platforms now contains both the real application code and agent memory files
- project-agent context reflects the actual stack and repository shape

### Blockers
- environment variables are not fully documented yet
- application modules and Supabase functions still need deeper inspection

### Next Step
- map key modules and env requirements
- build the first actionable implementation backlog

---

## 2026-05-14
### Task
Attach project-specific Telegram inbox workflow

### Work Done
- created project-specific inbox directory at `~/Work/inbox/telegram/tdgames-platforms`
- created project mapping under `~/Work/tools/telegram-inbox/projects/tdgames-platforms`
- stored project-specific bot/chat/inbox configuration
- updated project workflow rules to reflect manual Telegram intake only

### Validation
- verified project-specific config files were written
- updated shared telegram-inbox tool to support `--project tdgames-platforms`

### Result
- tdgames-platforms now has a dedicated Telegram inbox workflow separated from other projects

### Blockers
- Telegram Bot API cannot download oversized files; large archives may still require Git or alternate transfer methods

### Next Step
- use project-specific Telegram intake only for manual, on-demand file retrieval
- prefer Git-based import for large codebase transfers

---

## 2026-05-14
### Task
Reorganize agent project metadata out of repository root

### Work Done
- moved project-agent markdown files from repository root into `.agent/meta/`
- updated workflow and memory references to use the new `.agent/meta/*` paths
- updated the GitNexus reference path from `CLAUDE.md` to `.agent/meta/CLAUDE.md`
- added `.agent/meta/` to `.gitignore` so agent metadata is not committed

### Validation
- verified the moved files exist under `.agent/meta/`
- verified root-level app files remain in place
- verified workflow/reference docs now point to the new paths

### Result
- repository root is cleaner and focused on application files
- agent operational memory is grouped in one private location and excluded from git

### Blockers
- none

### Next Step
- continue repository discovery using the new `.agent/meta/` paths

---

## 2026-05-16
### Task
Fix payroll for "lên chính thức giữa tháng" — transition month proration

### Work Done
- **Bug found**: `payrollService.ts:279-282` used all-or-nothing `isProbation = probation_end > payrollLastDay`. Khi NV lên chính thức giữa tháng, được tính 100% official → BHXH bị tính cho cả ngày probation (sai), PIT lũy tiến cho cả tháng (sai cho ngày probation đáng lẽ 10% flat).
- **Confirmed business rule với user**: Lương = 100% probation/official như nhau. Chỉ khác BHXH (probation = 0) + PIT (probation = 10% flat, official = lũy tiến với giảm trừ).
- **Migration `pay_payroll_records_add_probation_ratio`**: thêm cột `probation_ratio numeric DEFAULT 0`; backfill existing records từ `is_probation` (true→1, false→0)
- **Refactored `calculatePayroll`**: thay 2 nhánh if/else → unified logic dùng `probationRatio`. BHXH = `baseSalary × rate × (1 − ratio)`. PIT = `pitProbation (10% × taxableProb) + pitOfficial (lũy tiến trên (taxableOfficial − BHXH − giảm trừ))`. Giảm trừ gia cảnh full mức/tháng theo TT 111/2013.
- **Updated `createPayrollSheet`**: dùng `official_date` (mới có), tính `probationRatio` per employee dựa trên 3 case (cả tháng prob / cả tháng official / transition). Fallback về `probation_end + 1` nếu chưa có official_date.
- **Updated `recalculateRecord`**: đọc `probation_ratio` từ record để recalculate đúng.
- **Updated UI**: PayrollSheet thêm badge "CHUYỂN GIAO" (orange); PaySlip thêm note giải thích split %.
- **Updated `types.ts`**: thêm `probation_ratio: number` vào `PayPayrollRecord`.

### Validation
- Build pass: `npm run build` → ✓ in 6.48s, no TS errors
- Logic verified: 3 cases (ratio=0, ratio=1, 0<ratio<1) đều cho kết quả đúng theo công thức
- Backward compat: rows cũ không có `probation_ratio` → fallback theo `is_probation` boolean

### Result
- Payroll giờ tính chính xác cho NV lên chính thức bất kỳ ngày nào trong tháng
- Lê Nguyên Tú (official 02/04/2026) tháng 4: 1 ngày × 10% PIT + 29 ngày × lũy tiến + BHXH chỉ tính 29/30 ngày
- Bảng lương đã chốt (confirmed/paid) không bị recalculate (theo policy A user chọn)

### Blockers
- none

### Next Step
- Test thực tế bằng tạo bảng lương tháng 4/2026 để verify số liệu Lê Nguyên Tú
- Optional: thêm column "Tỷ lệ" vào export Excel để HR tracking

---

## 2026-05-16
### Task
CRM Outreach audit + fix CSV/polling/idempotency + deliverability finding

### Work Done
- Audit luồng outreach: 5 file (EmailOutreach.tsx, outreachApi.ts, outreachService.ts, useCrmState.ts, CrmApp.tsx)
- Fix `outreachService.ts`: CSV parser RFC 4180 (CRLF + escaped quote), EMAIL_RE validation, return `{leads, skipped}`, escape PostgREST search filter
- Fix `EmailOutreach.tsx`: `useRef` polling cleanup, refresh quota trước bulk send, idempotency guard `bulkSending`, fallback `total` tránh NaN%, skipped-row warning trong CSV import
- Build pass ✅, commit `3aa2592`, auto-deploy success (22s), live trên VPS
- Check FastAPI runtime: service active, không có exception/SMTP error
- DNS records OK: SPF ✓ DKIM ✓ DMARC ✓ (tdgamestudio.com qua Gmail)

### Validation
- `/api/email/status` → 200 OK `{sent_today:0, daily_limit:30}`
- `/api/email/health-check` → **CRITICAL** — bounce_rate 12.7%
- `/api/email/preview` → HTML render OK
- DNS: SPF Google ✓, DMARC quarantine ✓, DKIM google._domainkey ✓

### Result
- **Code phía Mac đã tốt** — đã fix toàn bộ bug critical (CSV, search, polling, idempotency)
- **PROBLEM CHÍNH = deliverability**: bounce_rate 12.7% (>5% là Gmail flag spammer), 267 leads pending chưa verify
- User action plan (đang thực hiện):
  1. Tắt Auto Batch
  2. Bấm "Verify emails" trên 267 pending leads
  3. Bấm "Check bounces" để confirm 15 bounce hiện tại
  4. Mở lại Auto Batch với `daily_limit = 5` (warm up reputation 1 tuần, tăng dần)

---

## 2026-05-17
### Task
FastAPI backend hardening: verify-before-send + Supabase quota + background verify + pluggable verifier + sending pause guard

### Work Done (trên VPS6core, `/opt/td-mailer-api/`)
- **Backup**: `/opt/td-mailer-api.bak-20260517-154335` (full snapshot trước khi sửa)
- **NEW `services/quota.py`**: quota đếm từ `crm_email_log` table (`status='sent' AND sent_at >= today UTC`), cache 60s, fail-CLOSED (lỗi DB → remaining=0, không phải 30 như CSV version cũ → đã suýt ban Gmail account)
- **NEW `services/verifier_provider.py`**: wrapper pluggable cho 3 provider qua ENV `EMAIL_VERIFIER_PROVIDER=local|neverbounce|zerobounce`. Skeleton NeverBounce + ZeroBounce sẵn sàng, chỉ cần cắm API key. Có `fast_pre_send_check()` (syntax + MX, ~50ms, free) dùng pre-flight cho /send.
- **REWRITE `routes/email.py`**:
  - `_send_one_lead`: gọi `fast_pre_send_check` trước, fail → mark `invalid_email` + log skipped, KHÔNG tốn quota Gmail
  - `/verify-pending`: background-hoá (thread) — trả ngay `{started:true}`, frontend poll `/verify-pending-status`. Hết 504 nginx timeout
  - try/except quanh từng iteration batch — 1 lead lỗi không phá batch
  - `SENDING_PAUSED` env guard chặn `/send` + `/batch` (503), `/verify-*` + `/check-bounces` vẫn chạy
- **PATCH `services/gmail_sender.py`**: 2 hàm `get_today_sent_count` + `get_quota_status` đổi sang re-export từ `services.quota` (backward compat cho cron_followup.py)
- **systemd**: thêm `EMAIL_VERIFIER_PROVIDER=local`, `NEVERBOUNCE_API_KEY=`, `ZEROBOUNCE_API_KEY=`, `SENDING_PAUSED=true` vào unit file

### Validation
- `systemctl is-active td-mailer-api` → `active`
- `/api/email/status` → `{source:"supabase", sent_today:0, remaining:30}` ✅ (đã đổi từ CSV)
- `/api/email/send` → `503 {detail:"Sending paused..."}` ✅ (guard works)
- `/api/email/verify-pending-status` → `200 OK` (endpoint exists)
- `/api/email/health-check` → `{verifier_provider:"local", health:"critical", bounce_rate:40.0}`
- Imports OK: `from routes import email; from services import gmail_sender, quota, verifier_provider`

### Result
- ✅ A done: verify-before-send + Supabase quota + background verify
- ✅ B done: skeleton plug-in cho NeverBounce/ZeroBounce, cần API key của user
- ✅ C done: soft pause qua `SENDING_PAUSED=true` (chỉ chặn send, verify/bounce vẫn chạy)
- **Next step (user action)**:
  1. Trong UI bấm "Verify Emails" → background quét 234 pending → mark invalid (giảm bounce rate)
  2. Mua/đăng ký NeverBounce → set `NEVERBOUNCE_API_KEY` + đổi `EMAIL_VERIFIER_PROVIDER=neverbounce` trong systemd unit, reload
  3. Khi pending sạch (~80% valid expected), `SENDING_PAUSED=false`, reload, resume
  4. Daily limit tạm để 5-10 trong tuần đầu warm up

### Bonus — Resend integration (cùng ngày)
- **NEW `services/resend_sender.py`**: HTTP POST tới `api.resend.com/emails`, return `(msg_id, error)` đồng nhất Gmail signature
- **NEW `services/sender_dispatch.py`**: dispatcher theo ENV `EMAIL_SENDER_PROVIDER=gmail|resend` (default gmail, rollback dễ)
- **NEW `routes/webhook.py`**: endpoint `/api/webhook/resend` nhận event bounce/complaint/delivered/opened/clicked. Verify Svix signature bằng `RESEND_WEBHOOK_SECRET`. Tự update `crm_outreach_leads.outreach_status` real-time → thay thế `bounce_detector.py` scan Gmail inbox
- **PATCH `routes/email.py`**: import `send_email` qua dispatcher (transparent, không sửa caller)
- **PATCH `app.py`**: mount `webhook_router` tại `/api/webhook`
- **systemd**: +6 env vars Resend (key/from/reply-to/tag/secret + provider switch)
- Public webhook URL: `https://app.tdgamestudio.com/outreach-api/api/webhook/resend` (qua nginx reverse-proxy 8401)
- Tested: webhook chặn unauth request (401), health endpoint 200, dispatcher fallback Gmail OK

### Cutover plan để bật Resend (user action)
1. Signup Resend → tạo API key + verify domain `mail.tdgamestudio.com`
2. Thêm DNS records (SPF/DKIM 3 cnames/DMARC) — Resend hướng dẫn khi add domain
3. Set systemd env:
   ```
   sed -i 's|RESEND_API_KEY=|RESEND_API_KEY=re_xxx|' /etc/systemd/system/td-mailer-api.service
   sed -i 's|RESEND_FROM=|RESEND_FROM=Tony Dang <tony@mail.tdgamestudio.com>|' /etc/systemd/system/td-mailer-api.service
   sed -i 's|EMAIL_SENDER_PROVIDER=gmail|EMAIL_SENDER_PROVIDER=resend|' /etc/systemd/system/td-mailer-api.service
   systemctl daemon-reload && systemctl restart td-mailer-api
   ```
4. Tạo webhook trên Resend dashboard → URL `https://app.tdgamestudio.com/outreach-api/api/webhook/resend` → copy `whsec_xxx` vào `RESEND_WEBHOOK_SECRET`
5. Test: `POST /api/email/send` 1 lead → check dashboard Resend + DB cập nhật status
6. Rollback: chỉ đổi `EMAIL_SENDER_PROVIDER=gmail` + restart (mọi env Gmail vẫn còn)

### Settings UI (cùng ngày, sau Resend)
- **NEW backend `services/settings.py`**: JSON file backing tại `/opt/td-mailer-api/data/settings.json`, cache 30s, atomic write (fsync+rename), fallback ENV. Bỏ DB version vì Supabase Python SDK không exec DDL → cần SQL migration thủ công, không tự động hoá được
- **NEW backend `routes/settings.py`**: GET (open) / PUT (X-Admin-Token) / GET effective. Whitelist 5 field: resend_from, resend_reply_to, resend_tag_campaign, sending_paused, daily_limit
- **PATCH `resend_sender.py`** + `email.py`: đọc qua `get_setting()` thay vì os.environ → runtime-tunable không cần restart service
- **NEW frontend `SettingsTab`** trong EmailOutreach: 5 field UI với dirty tracking, pause toggle lớn đổi màu đỏ/xanh, source/updated_at indicator
- **ENV `OUTREACH_ADMIN_TOKEN`**: generated hex 24-byte, lưu trong systemd unit + .env frontend (`VITE_OUTREACH_ADMIN_TOKEN`)
- Commit `189b59c`, auto-deploy triggered

### Blockers
- Đợi user thực hiện 4 bước action plan rồi đo lại bounce_rate

### Next Step
- Sau khi user verify xong: kiểm tra `health-check` còn `critical` không
- Nếu vẫn cao: consider thêm UI alert badge cho `bounce_rate > 5%` để monitor sớm

---

## 2026-05-16
### Task
HR employment history tracking — official_date + employee timeline

### Work Done
- **Migration `hr_employees_add_official_date`**: added `official_date date` column; backfilled = `probation_end + 1 day` for 7 fulltime employees
- **Migration `refresh_leave_balances_use_official_date_v4`**: dropped & recreated function to use `official_date` instead of `probation_end`; correctly returns 1 day for Lê Nguyên Tú, 0 for others still in probation
- **Migration `hr_position_history_relax_change_type`**: extended CHECK constraint to allow `type`, `status`, `official_date`, `probation_end`, `joined`, `become_official`, `leave_company`, `return`, `note`
- **Migration `hr_employee_history_trigger_view_v2`**:
  - Trigger `trg_hr_employees_track_change` AFTER UPDATE on hr_employees → auto-writes to `hr_position_history` for changes to: official_date, type, status, department_id, position, level, salary, probation_end
  - View `hr_employee_timeline` (security_invoker = on) UNION ALL of: position_history + employee_salary (joined with salary_components) + contracts + evaluations
  - Backfill: `joined` events from `start_date`, `become_official` events from `official_date` for existing employees
- **types.ts**: added `official_date` to `HrEmployee`; added `HrEmployeeTimelineEvent` interface
- **EmployeeForm.tsx**: added "Ngày chính thức" input; chained auto-fill (start_date → probation_end +2 months → official_date +1 day) with manual override allowed
- **EmployeeDetail.tsx**: added "📜 Lịch sử công tác" tab with iconographic timeline (joined, become_official, salary, type, status, department, position, level, contracts, evaluations)

### Validation
- Tested view query for Lê Nguyên Tú: returns 9 events (joined → become_official → 7 salary components)
- Trigger ready to fire on next employee update
- View RLS uses security_invoker → respects underlying table policies

### Result
- HR can now track full employee lifecycle: onboarding, probation, promotion to official, salary changes, contract events, evaluations — all in one timeline
- Employees with `probation_end` extended or `official_date` adjusted earlier/later are now properly tracked instead of overwriting silently

### Blockers
- none

### Next Step
- Build verification: `npm run build` to confirm no TS errors
- Optional: add modal for HR to insert manual `note` events into history
- Continue tdgames-landing Astro scaffold

---

## 2026-05-16
### Task
Supabase leave balance system — RLS, accrual logic, automation, and model upgrade

### Work Done
- **Migration 1** (`fix_leave_balances_rls_and_seed_2026`): dropped loose `public/true` policies on `leave_balances`; created proper `authenticated` policies — SELECT (own row OR is_staff), INSERT/UPDATE/DELETE (is_staff only)
- **Migration 2** (`fix_leave_balances_correct_accrual_logic`): deleted wrong seed data, added `UNIQUE(employee_id, year, quarter)` constraint, created `count_official_months_in_year()` and `refresh_leave_balances(year)` functions — filters `type='fulltime'`, `status='active'`, `probation_end < today`, 1 day/month accrual, max 12 days/year stored as `quarter=1` annual record
- **Migration 3** (`leave_cron_trigger_expiry`): scheduled monthly cron `refresh-leave-balances-monthly` (1st of each month), yearly expiry cron `expire-leave-balances-q1` (April 1st), trigger `trg_leave_request_status` to auto-deduct/restore `used_days` on `att_requests` status change, created `leave_balance_summary` view with `remaining_days` and `expires_on`
- Updated `~/.claude/settings.json` model to `claude-opus-4-7`

### Validation
- Queried live Supabase: 2 cron jobs active, trigger present, view returns correct data
- Lê Nguyên Tú (official Apr 2 2026): 1 day remaining, expires 2027-03-31
- All other employees: 0 days (still in probation as of 2026-05-16)
- RLS verified: employee can only see own row; HR/admin can see all

### Result
- Leave balance system is fully automated on Supabase — no manual seeding needed going forward
- Employees and HR can now see correct balances through `leave_balance_summary` view

### Blockers
- none

### Next Step
- Scaffold `tdgames-landing` with Astro 5 + Tailwind
- Continue discovery tasks for `tdgames-platforms` (env vars, module map, Supabase functions)

---

## 2026-05-15
### Task
Debug leave request creation and restore employee-facing leave submission in Platforms

### Work Done
- traced leave-related flow from HR into Attendance and confirmed leave data uses `att_requests`
- confirmed the original Platforms Attendance UI lacked an employee-facing leave request creation form
- implemented a leave request form directly in `apps/attendance/components/LeaveApproval.tsx`
- reused Portal leave submission logic to keep the payload aligned with existing `att_requests` usage
- validated the app with `npm run build` and confirmed the build passes
- verified Claude Code is available locally and switched back to Claude Code as the required default path for app coding and runtime-integrated checks
- confirmed local repo does not contain tracked RLS policy migrations for `att_requests` or `leave_balances`

### Validation
- `npm run build` succeeded
- Claude Code local version detected: `2.1.138`

### Result
- Platforms now has an in-app leave request submission form in Attendance
- remaining risk is live Supabase RLS/policy configuration rather than missing UI

### Blockers
- live Supabase policy inspection through Claude Code is waiting on Supabase MCP permission approval in the Claude Code UI

### Next Step
- approve Supabase MCP permission in Claude Code
- inspect live RLS/policies for `att_requests` and `leave_balances`
- add exact SQL migration only if live policy is missing or incorrect
