# TASKS

_Cập nhật: 2026-06-17_

---

## To Do

- [ ] Siết RLS nhóm bảng `wf_*` (workforce) — hiện qual=true cho authenticated; cần ownership predicate cho freelancer portal (match qua email/auth_user_id) trước khi siết. Deferred từ session 2026-07-02.

- [x] Build Accounting — Tiết kiệm & Vay nợ (2 tabs mới)
  - Done: 2026-05-28
  - Result: SavingsTab (add/settle/renew + warning 30 ngày), LoansTab (add/repay/pay-off + overdue warning), CashFlow integration qua expense_expenses, DB acc_savings + acc_loans đã có RLS. Commit 88ed9c4 ✅

- [x] Fix Company app UI/UX theo Style Guide
  - Done: 2026-05-21
  - Result: footer border-white/5; InfoTab 2-col layout + SidebarItem; BankTab grid-cols-2; DocumentsTab inputs focus style. Commit 577b14f ✅

- [x] Fix Accounting UI/UX theo Style Guide (6 tabs)
  - Done: 2026-05-21
  - Result: PayablesTab, PnlTab, BankReconcTab, VatTab, TncnTab, AdvanceTab — KPI labels → text-[10px] font-black text-neutral-600, values → text-2xl, form inputs → #1a1a1a px-3 py-2, buttons font-bold → font-black. Commit 7265ea8 ✅

- [x] Thêm HelpPanel cho các module còn thiếu (Attendance, CRM, Payroll, Workforce)
  - Done: 2026-05-21
  - Result: 4 module wired; tất cả 8 app chính đều có HelpPanel. Commit 7f40aec.

- [x] Nhập 4 invoice còn thiếu của TD CONSULTING (Jan–Apr 2026)
  - Done: 2026-05-21 (confirmed by user — đã triển khai)
  - Result: TC-202601-001, TC-202602-001, TC-202604-002, TC-202605-003 tồn tại trong invoice_invoices với billing_entity = 'TD CONSULTING' ✅

- [x] Verify dữ liệu thực tế cho Accounting Phase 3 (VAT + TNCN)
  - Done: 2026-05-21
  - Result: VatTab — 11 invoices có issue_date + billing_entity đúng; tax_rate=0% toàn bộ (đúng với export services). TncnTab — 2 sheets paid (T3: 544,500₫ PIT / T4: 1,241,408₫ PIT), pivot hiển thị đúng năm 2026.

---

## Doing

_(trống)_

## Done (mới)

- [x] Payroll → Discord notification khi xác nhận bảng lương
  - Done: 2026-07-03
  - Result: DB trigger `notify_payroll_confirmed()` trên `pay_payroll_sheets` (AFTER UPDATE OF status, khi chuyển sang 'confirmed') gửi Discord webhook đọc từ `app_config.discord_payroll_webhook`. Migration `20260707120000_payroll_discord_notifications.sql`.
  - **Sửa 20260707130000**: bản đầu SAI mục đích — gửi báo cáo tài chính nội bộ (tổng net, tổng chi phí công ty) kèm dự định gắn @everyone → SUÝT lộ số liệu lương ra toàn công ty. Sửa lại thành thông báo cho NHÂN VIÊN (mời vào Portal kiểm tra + tự xác nhận phiếu lương), theo đúng mẫu sếp đã dùng thủ công ở session 17 (@everyone + heading + 3 bước cần làm + lưu ý + link Portal), không có số liệu tài chính nào. Migration `20260707130000_fix_payroll_discord_employee_announcement.sql`.
  - **BUG NGHIÊM TRỌNG + fix 20260707140000**: đặt tên hàm `notify_payroll_confirmed()` trùng với hàm ĐÃ CÓ SẴN từ 2026-06-03 (`20260603100000_payroll_employee_acknowledgement.sql`, gắn trigger `trg_notify_payroll_confirmed` — insert notification + gửi email thật cho nhân viên). Dùng `CREATE OR REPLACE FUNCTION` mà không kiểm tra trùng tên → ghi đè mất logic gốc. Hậu quả: lúc test (rollback+confirm lại sheet T6/2026), CẢ 2 trigger cùng chạy chung 1 hàm (đã bị ghi đè) → Discord nhận 2 tin giống hệt nhau; đồng thời in-app notification + email thật cho nhân viên bị hỏng ngầm (không lỗi nhưng không chạy đúng). Sếp phát hiện qua việc thấy 2 tin trùng. Fix: khôi phục nguyên bản `notify_payroll_confirmed()`, đổi tên hàm Discord thành `notify_payroll_confirmed_discord()`, trỏ lại trigger `trg_payroll_discord_confirmed` sang hàm mới. Verify lại bằng `pg_trigger` — 2 trigger đã tách đúng 2 hàm riêng. Migration `20260707140000_fix_payroll_notify_function_collision.sql`.
  - **Bài học**: LẼ RA phải chạy `gitnexus_impact({target: "notify_payroll_confirmed"})` hoặc ít nhất grep tên hàm trong migrations trước khi `CREATE OR REPLACE FUNCTION` — theo đúng rule "MUST run impact analysis before editing any symbol" trong CLAUDE.md mà đã bỏ qua vì tưởng đây là hàm hoàn toàn mới.
  - **Sửa 20260707150000**: đổi dòng "🔗 Truy cập nhanh: app.tdgamestudio.com → Portal" (text thuần) thành link bấm được `https://app.tdgamestudio.com/#portal`. Chỉ update function `notify_payroll_confirmed_discord()`, không đổi trigger, không gửi tin test.

---

## Recently Completed

- [x] Workforce: nghiệm thu freelancer bắt buộc theo từng dự án (project_name)
  - Done: 2026-07-03
  - Result: `wf_settlements` thêm cột `project_name` (migration `20260707110000`, applied prod qua MCP, không backfill record cũ). Chuỗi truyền tham số `createSettlement`/`handleCreateSettlement`/`SettlementManager` thêm `projectName`. `SettlementCreateView.tsx`: dropdown "Dự án *" (đếm số task/dự án, sort giảm dần) hiện sau khi chọn Nhân sự; danh sách task chỉ hiện task của đúng 1 dự án đã chọn (`workerProjectTasks`); đổi Nhân sự reset dropdown Dự án + task đã chọn; đổi Dự án reset task đã chọn; placeholder "Vui lòng chọn dự án" khi chưa chọn. `SettlementListView.tsx` + `SettlementDetailView.tsx`: hiện `· {project_name}` cạnh tên nhân sự (rỗng cho settlement cũ, không hiện "—"/"undefined"). Commits 9a00784→47e853f (7 commits, theo plan `docs/superpowers/plans/2026-07-03-settlement-per-project.md`). Build ✅ (vite build 9.36s, 0 lỗi). Lint (`tsc --noEmit`) còn nhiều lỗi TS pre-existing không liên quan (EmailOutreach, EmployeeForm, hrService, types.ts contract_value dup...) — đã xác nhận không phải do thay đổi này (không đụng các file đó). GitNexus MCP không khả dụng session này → review thủ công diff so với plan thay thế.

- [x] Payroll: blend KPI/Tăng ca cho tháng chuyển giao + fix data T6/2026 (3 NV)
  - Done: 2026-07-03
  - Result: `calculatePayroll` chỉ blend lương cũ/mới cho Lương CB khi NV lên chính thức giữa tháng, KHÔNG blend KPI/Tăng ca → tính nhầm phần thử việc theo mức mới (case Tú T6/2026: net thừa ~1.75tr). Fix: tổng quát hoá blend sang `preOfficialKpiAllowance`/`preOfficialDefaultOt` trong `PayrollInput`; `createPayrollSheet` auto-detect mức cũ từ lịch sử `hr_employee_salary`, tách theo `official_date` (không chỉ so 2 bản ghi liền kề — tránh lấy nhầm giá trị trung gian khi có sửa/correct nhiều lần cùng ngày, phát hiện qua case Nguyễn Đức Hiếu); `recalculateRecord` đọc field mới. DB: 2 cột `pre_official_kpi_allowance`/`pre_official_default_ot` (migration `20260707100000`, applied qua MCP). UI: thêm 2 ô nhập tay mirror UI Lương CB trong `PayrollSheet.tsx` (panel Chi tiết tính lương), mặc định hiện giá trị auto-detect, kế toán sửa khi cần. Data fix: patch trực tiếp 3 record T6/2026 (Tú, Hiếu, Bảo Anh — tất cả NV chuyển giao trong tháng) thay vì xoá-tạo-lại sheet (tránh mất 4 bonus + 3 note đã nhập tay của các NV khác trong sheet). Net giảm: Tú 15.965.000→14.216.652, Hiếu 14.010.454→12.716.653, Bảo Anh 13.453.444→11.610.473. Commits 4e53202, afd2db7. Build/lint ✅ (không lỗi mới).
  - Plan: `docs/superpowers/plans/2026-07-03-payroll-pre-official-kpi-ot-blend.md`

- [x] Fix bảng lương T6 rỗng — prod thiếu cột `bhxh_exempt` trong `pay_payroll_records`
  - Done: 2026-07-02
  - Result: Insert records fail vì code mới ghi cột `bhxh_exempt` nhưng prod chưa có → sheet tạo ra rỗng. Applied prod qua MCP (`add_bhxh_exempt_to_pay_payroll_records`) + lưu file `supabase/migrations/20260707000000_add_bhxh_exempt_pay_payroll_records.sql`. Verified information_schema: cột boolean DEFAULT false tồn tại. Kế toán cần xoá sheet T6 rỗng và tạo lại.

- [x] Invoice History — Edit hoá đơn cũ update thật (không tạo bản trùng)
  - Done: 2026-07-01 (session 12)
  - Result: Trước đây bấm Edit trong History rồi Save luôn INSERT bản mới (trùng dữ liệu, id cũ mồ côi). Thêm `canEditInvoice()` (pending + chưa xuất/xuất fail eInvoice) + `updateInvoiceInCloud()` trong supabaseService.ts (tách `buildInvoiceRecord` dùng chung); `persistInvoice()` trong useInvoiceState.ts điều phối insert vs update dựa trên `invoice.id` + guard `canEditInvoice`; HistoryTab disable nút Edit + tooltip khi hoá đơn đã paid/đã xuất eInvoice (dùng Duplicate thay thế); InvoiceEditor đổi label nút "Save Invoice" → "Update Invoice" khi đang sửa. Build ✅ (542 modules, 0 lỗi TS). GitNexus MCP không khả dụng session này (đã thử `select:gitnexus_impact,...` — không match) → review thủ công qua grep call sites thay thế.

- [x] Fix SePay eInvoice fails cho khách nước ngoài có MST không đúng chuẩn VN
  - Done: 2026-07-01 (session 10)
  - Result: Root cause — `mapInvoiceToSePay` (sePayService.ts) gửi thẳng `taxCode` nước ngoài (VD CIF Tây Ban Nha "B64965437") làm `buyer.tax_code` khi `clientType='company'`, bị SePay/CQT từ chối vì không phải MST VN (10 số). Fix: chỉ set `buyer.type='company'` + gửi `tax_code` khi taxCode khớp regex MST VN `/^\d{10}(-\d{3})?$/`; MST nước ngoài fallback `type:'personal'`, `tax_code:''`, giữ lại trong `notes` gửi SePay. Không đổi `client_info.taxCode` lưu DB/PDF nội bộ. Verify end-to-end bằng curl trực tiếp sepay-proxy (`create-draft` + `check-status`) với payload đã fix cho khách "Social Point, S.L." → SePay trả `status: Success`, tạo được pdf_url. Build ✅
  - Note: Invoice `INV-202606-011` (client Social Point, S.L.) vẫn đang `einvoice_status='failed'` trong DB — cần retry tạo eInvoice qua UI để cập nhật tracking_code/reference_code thật.

- [x] Fix duplicate CRM client "Social Point SL" vs "Social Point, S.L."
  - Done: 2026-07-01 (session 9)
  - Result: Merge data (crm_projects, crm_documents, 3 invoices đã issued) về 1 client canonical; xoá record trùng; fix root cause dedup logic (normalizeClientName) trong useInvoiceState.ts. Build ✅

- [x] CRM Payment Schedule P3 — PaymentTracker sub-tab "Lịch TT"
  - Done: 2026-06-26 (session 5)
  - Result: Sub-tab toggle (Tất cả invoices / 💳 Lịch TT), conditional render PaymentScheduleTracker, currentUser passed từ CrmApp xuống. Build ✅ push ✅ commit 7b429a1

- [x] Onboarding Acknowledgment Flow (5 tasks)
  - Done: 2026-06-26 (session 4)
  - Result: DB migration (is_required + onboarding_completed_at + hr_onboarding_acknowledgments + RLS), types/service (fetchRequiredArticles, checkOnboardingNeeded, submitOnboardingAcks), HandbookAdminTab toggle is_required, OnboardingScreen component, App.tsx state machine step 3. Bug fix: checkOnboardingNeeded dùng count thay vì arts?.length. Build ✅ push ✅

- [x] Handbook — Danh bạ nhân viên tab (move directory from Portal to Handbook)
  - Done: 2026-06-26 (session 3)
  - Result: HandbookApp gains "👥 Danh bạ" tab (lazy-load, cyan cards, avatar, dept, contact info). PortalApp drops directory tab entirely; default tab → payslip. Build ✅ commit 262b8fc push ✅

- [x] Sổ tay nhân viên (Employee Handbook) — `#handbook` mini-app
  - Done: 2026-06-26
  - Result: HandbookApp (read-only, sidebar + search + article reader), HandbookAdminTab trong CompanyApp (CRUD danh mục + bài viết, draft/publish). DB migration applied + seeded 5 danh mục mặc định. Route `#handbook` wired + accessible to admin/hr/ke_toan/member/bd. Build ✅ commit 1aa36ed push ✅

- [x] CRM P2 — Quotation (Báo giá)
  - Done: 2026-07-01
  - Result: CrmQuotation type + DB migration + CRUD service + "Báo giá" tab in DealDetailPanel. Create quotation with line items (desc/qty/unit/price), auto subtotal, validity period, status flow (draft→sent→accepted/rejected). Build ✅

- [x] CRM P2 — BD Performance Report
  - Done: 2026-06-30
  - Result: Per-BD table in dashboard (Active/Won/Lost/Win Rate/Avg Days to Close), per-BD pipeline+won values, total row with aggregates. Build ✅

- [x] CRM P1 — Follow-up Reminders + Client Ownership
  - Done: 2026-06-29
  - Result: Follow-up: next_follow_up date on deals (card indicator, form picker, detail panel inline edit, dashboard section). Client Ownership: assigned_bd_name on clients (ClientList badge, ClientForm input). Migration + types + UI. Build ✅

- [x] BD Dashboard — CRM "Tổng quan" tab
  - Done: 2026-06-28
  - Result: KPI cards (Pipeline/Won/WinRate/Clients), pipeline funnel bar chart, deals needing attention (overdue + stale >14d), recent activities sidebar, won deals summary, quick action buttons. Default tab changed to dashboard. Build ✅

- [x] CRM Deal Pipeline — Board + Detail Panel + Filters (4 phases)
  - Done: 2026-06-27
  - Result: Phase 1 (Foundation): tách 661→76 dòng, 14 files. Phase 2 (Features): 3-tab detail panel, inline edit, stage rules. Phase 3 (Filters): stage/owner/currency filters + responsive metrics. Phase 4 (Polish): drag feedback, toast, days-in-stage, drop indicator, refetch on focus. Build ✅

- [x] Multi-role support (helper function approach)
  - Done: 2026-06-22
  - Result: Users can now have primary role + secondary_roles[]. Created hasRole/hasAnyRole/getUserRoles utils. Updated all 12 feature files. Added secondary roles toggle UI in EmployeeDetail. Updated edge function with update_secondary_roles action + check_email returns secondary_roles. Build passed ✅

- [x] Chỉnh sửa lương trên đề xuất HR (pending + approved)
  - Done: 2026-06-22
  - Result: Inline edit salary trên ChangeRequestTab — pending chỉ cập nhật request, approved cập nhật request + re-apply lương thực tế (rotateSalary + employee.salary + position history). Build passed ✅

- [x] AI Agent System — All 7 steps completed
  - Done: 2026-06-17
  - Commits: 57e5e22 → f147c82
  - Result: Step 1-6 (Backend, Frontend, Deploy, RLS, Extended Tools × 9 agents, Telegram + in-app chat). Step 7 Polish: notification badge trên Home (red dot count new insights), Agent Config Editor tab (edit model/temperature/personality/is_active/emoji). Build ✅

- [x] HR Change Request approval workflow
  - Done: 2026-06-17
  - Commits: 1db1433 → 169fb7f (10 commits on main)
  - Result: `hr_change_requests` table + 5 request types (probation_end, salary_change, promotion, department_transfer, termination); ChangeRequestTab + ChangeRequestForm trong HR; Portal Change Requests tab cho NV; auto-apply on approve (salary, position, department); email notification deep-link; delete button + old salary modal removed. Build ✅

- [x] Mid-month salary proration (tháng chuyển giao + tăng lương)
  - Done: 2026-06-12
  - Branch: feat/payroll-mid-month-salary-proration (commit e66142c)
  - Result: DB column `pre_official_base_salary`; calculatePayroll() dùng weighted salary (lươngCũ × probRatio + lươngMới × officialRatio); auto-detect từ hr_position_history; editable trong PayrollSheet; hiển thị prorate trong PaySlip + Excel export. Build ✅

- [x] Email deliverability — Primary inbox
  - Done: 2026-06-10
  - Root cause: `List-Unsubscribe` header → Gmail Promotions signal; `[TD Games]` bracket prefix → marketing pattern
  - Fix: v11 — xóa List-Unsubscribe + X-Mailer headers, xóa bracket prefix, from "TD Games Platform" → "TD Games"
  - Bonus: deep-link email → app (PortalEvalList auto-open), EMAIL_STANDARD.md, payslip_pending_review type
  - Result: email vào Primary ✅

- [x] Eval deadline + notify-on-create + pg_cron daily reminder
  - Done: 2026-06-08
  - Commits: 5bea894 → 8194523 (6 commits on main)
  - Result: deadline field UI (date picker + validation); DB migration: `deadline` column + `notify_eval_cycle_created` trigger (eval_assigned noti); pg_cron 01:00 UTC daily reminder 1 ngày trước hạn; notify-email edge function v4 deployed. Build ✅

- [x] Email notifications cho Evaluation workflow
  - Done: 2026-06-08
  - Result: trg_notify_eval_submission, trg_notify_eval_cycle_status; notify-email v3; 4 event types. VPS deploy fec1e59 ✅

- [x] Build Employee Evaluation v2 (HR tab + Portal tab)
  - Done: 2026-06-08
  - Branch: feat/employee-evaluation-v2 (6 commits)
  - Result: 2 bảng DB mới (hr_evaluation_cycles + hr_evaluation_submissions), evaluationService với gap detection, EvalTab trong HR app, EvalTab trong Portal. Build ✅, migration applied ✅

- [x] Thêm thưởng KPI vào Payroll (bonus field)
  - Done: 2026-05-29
  - Branch: feat/payroll-kpi-bonus (4 commits: db, types, service, UI+export)
  - Result: DB migration applied; bonus editable per nhân viên trong draft; cộng thẳng vào net+company cost; hiển thị trong PaySlip và Excel export. Build ✅

---

## Review

_(trống)_

---

## Done

- [x] Thêm HelpPanel cho Invoice, HR, Expense, Accounting
  - Done: 2026-05-21
  - Result: Commits 1774815 (invoice), 3c8854d (hr), f54b3d0 (expense), aba3008 (accounting + bank auto-match VAT fix). Deployed VPS ✅

- [x] Build Accounting Phase 3 — VAT theo quý & Quyết toán TNCN
  - Done: 2026-05-21
  - Result: VatTab (GTGT từ invoice_invoices, filter năm/quý, drill-down, CSV), TncnTab (pivot PIT×NV×tháng, export quyết toán). Accounting module hoàn chỉnh 7 tabs. Commit b4025fa.

- [x] Build Accounting Phase 2 — Công nợ AP, P&L, Đối chiếu ngân hàng
  - Done: 2026-05-21
  - Result: PayablesTab (group by vendor), PnlTab (3 views, CSS chart), BankReconcTab (CSV import Techcombank/BIDV, auto/manual match). Commit đi kèm Phase 3.

- [x] Multi-bank / multi-entity accounting architecture
  - Done: 2026-05-19 (session 7)
  - Result: Bảng `finance_bank_accounts`, 6 TK seeded; billing_entity + receiving_account_id vào invoice; CashFlowView tách 3 luồng TD GAMES / TD CONSULTING / Cá nhân. Commit c70d788.

- [x] Add Auto Discovery Tab to CRM Email Outreach + backend endpoint
  - Done: 2026-05-19
  - Result: 🤖 Auto sub-tab với country-rotation scheduler; Supabase migration (crm_discovered_studios + auto_discovery config); edge function outreach-auto-discovery; FastAPI /api/discovery/auto-run; pg_cron job #7; full chain verified. Commit 926c463.

- [x] Fix pg_cron → Edge Function auth (cron thật sự tự chạy)
  - Done: 2026-05-19
  - Result: Cả 2 edge functions nhận x-cron-secret; verify_jwt: false; cron auto-discovery 9:00 VN/ngày active ✅.

- [x] CRM Discovery v2 — Apollo.io + ZeroBounce integration
  - Done: 2026-05-19
  - Result: apollo.py, email_validator.py, 3 endpoints mới; "Tìm theo quốc gia" sub-tab; 21-country dropdown; Canada trả 1,938 studios ✅.

- [x] Migrate outreach settings → Supabase DB
  - Done: 2026-05-17
  - Result: Bảng crm_outreach_settings; settings.py rewrite DB-backed; GET/PUT persist vĩnh viễn.

- [x] FastAPI backend hardening (verify-before-send + quota + Resend + webhook)
  - Done: 2026-05-17
  - Result: quota.py từ Supabase; verifier_provider.py pluggable; background verify (no timeout); resend_sender.py + sender_dispatch.py; webhook /api/webhook/resend (Svix); SettingsTab frontend. Commit 189b59c.

- [x] Analytics tab + auto follow-up fix + quota bug fix (CRM)
  - Done: 2026-05-18
  - Result: /api/email/analytics endpoint; Analytics tab (KPI cards, bar chart 7 ngày, by_template, funnel); quota fix (delivered trạng thái); cron_followup dùng Resend.

- [x] Leave eligibility rules + Nghỉ sinh nhật + Làm remote
  - Done: 2026-05-18
  - Result: 4 loại phép có điều kiện hiển thị động; birthday (6 tháng chính thức, 1 lần/năm); remote (1 lần/tuần). Commit fb91589.

- [x] Simplify leave form (bỏ toggle cả ngày/theo giờ)
  - Done: 2026-05-18
  - Result: 1 form duy nhất, luôn có time_from/time_to, tự tính effectiveHours trừ nghỉ trưa. Commit 6c87a56.

- [x] Add hourly leave request to Employee Portal
  - Done: 2026-05-18
  - Result: 3 cột mới att_requests (leave_hours, time_from, time_to); toggle Cả ngày/Theo giờ; tự tính leave_days = hours/8. Commit 9d9ad52.

- [x] Fix HR Reminder bugs (birthday/anniversary next-year + auto-scan)
  - Done: 2026-05-18
  - Result: Birthday/anniversary dùng năm sau nếu đã qua; tab Nhắc việc tự scan khi mở. Commit 5497ff2.

- [x] Fix payroll "lên chính thức giữa tháng" (transition month proration)
  - Done: 2026-05-16
  - Result: cột probation_ratio; calculatePayroll 3 cases; BHXH/PIT split chính xác; badge "CHUYỂN GIAO" UI.

- [x] Add HR employment history tracking (official_date + timeline)
  - Done: 2026-05-16
  - Result: official_date column + backfill; trigger trg_hr_employees_track_change; view hr_employee_timeline; tab "Lịch sử công tác" trong EmployeeDetail.

- [x] Debug and restore employee leave request creation in Platforms Attendance
  - Done: 2026-05-16
  - Result: RLS fixed on leave_balances; accrual 1 day/month; cron monthly refresh + April expiry; trigger deduct used_days; leave_balance_summary view.

- [x] CRM Outreach audit + fix (CSV/polling/idempotency/deliverability)
  - Done: 2026-05-16
  - Result: CSV parser RFC 4180; polling cleanup useRef; idempotency guard; bounce_rate 12.7% discovered. Commit 3aa2592.

- [x] Analyze repository and align project-agent memory with real codebase
  - Done: 2026-05-14 → 2026-05-21 (ongoing refinement)
  - Result: Stack mapped (Vite + React + TypeScript + Supabase), modules documented through working sessions, TASKS/LOG/DECISIONS maintained throughout.

- [x] Review environment requirements and identify all required local variables
  - Done: 2026-05-14 (superseded — team operating fine via .env.local)
  - Result: Supabase URL/key identified; VITE_* vars documented through usage.

- [x] Inspect application structure under apps/, components/, and services/
  - Done: 2026-05-14 (superseded — deep module knowledge demonstrated across sessions)
  - Result: 10+ modules mapped: HR, Payroll, Attendance, Invoice, Expense, CRM, Accounting, Portal, etc.

- [x] Verify Supabase local artifacts and serverless function responsibilities
  - Done: 2026-05-19 (superseded — edge functions deployed and documented)
  - Result: outreach-auto-batch, outreach-auto-discovery deployed + documented. pg_cron 7 jobs active.

- [x] Prepare the first real implementation backlog
  - Done: 2026-05-16 (superseded by actual delivery)
  - Result: Full delivery roadmap executed: HR → Payroll → Attendance → CRM → Accounting.

- [x] Bootstrap project-agent structure
  - Done: 2026-05-14
  - Result: Standardized project memory and workflow files created.

- [x] Import codebase into project root
  - Done: 2026-05-14
  - Result: Repository imported from GitHub into ~/Work/apps/tdgames-platforms.

- [x] Attach project-specific Telegram inbox workflow
  - Done: 2026-05-14
  - Result: Dedicated inbox path and project mapping created for manual Telegram file intake.

- [x] 2026-07-02 Fix RLS multi-role: ketoan (secondary hr) lưu được hợp đồng trong app HR

- [x] RLS audit + siết policy toàn platform (17 bảng) + fix frontend `isBd` multi-role
  - Done: 2026-07-02
  - Result: Migration `20260702120000_tighten_rls_role_policies.sql` (applied prod qua MCP): finance_fx_rates (write→admin/ke_toan), outreach 6 bảng (anon policies scope TO anon cho external API, authenticated→admin/ke_toan/bd), CRM core 7 bảng (→admin/ke_toan/bd), expense_budgets (→is_admin_or_ke_toan), acc_bhxh_payments (xoá 3 policy trùng wide-open), hr_change_requests (read=admin/hr hoặc chính chủ), hr_evaluation_cycles/submissions (write scoped leader/evaluator/hr). Frontend: 5 file CRM đổi `role === 'bd'` → `hasRole/hasAnyRole` (admin kiêm bd không bị bó quyền). Build ✅. wf_* deferred (xem To Do).

## Backlog (ghi nhận 2026-07-02)
- [ ] ClickUp sync: task nhiều assignee — hiện chỉ gán người đầu tiên khớp email; rủi ro duplicate nếu thứ tự assignee đổi giữa các lần sync (check tồn tại theo cặp clickup_task_id+worker_id). Sếp quyết định TẠM GIỮ NGUYÊN. Khi làm: tối thiểu fix duplicate (check theo clickup_task_id), cân nhắc chia client_price cho nhiều người.

- [x] Fix PIT tháng chuyển giao — double-apply probRatio lên KPI blend + bonus bị cấn nhầm vào thử việc
  - Done: 2026-07-03
  - Result: `calculatePayroll` (payrollService.ts) — tách `taxableProbation` theo từng khoản khi `0<probRatio<1` thay vì nhân `probRatio` lên `taxableIncome` gộp (đã double-apply lên KPI blend + cấn nhầm bonus vào thuế 10% thử việc). Verify khớp tuyệt đối với số kế toán tính tay cho cả 3 NV chuyển giao T6/2026. Đã update trực tiếp `pit`/`net_salary` của 3 record trong DB (Hiếu, Tú, Bảo Anh). Commit `df0e115`.
