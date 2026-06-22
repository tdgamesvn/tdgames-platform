# TASKS

_Cập nhật: 2026-06-17_

---

## To Do

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

---

## Recently Completed

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
