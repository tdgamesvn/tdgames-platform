# TASKS

_Cập nhật: 2026-05-21_

---

## To Do

- [ ] Thêm HelpPanel cho các module còn thiếu (Attendance, CRM, Payroll, Portal)
  - Priority: Low
  - Type: UX polish
  - Done when: mỗi module có HelpPanel giống Invoice/HR/Expense/Accounting

- [ ] Nhập 4 invoice còn thiếu của TD CONSULTING (Jan–Apr 2026)
  - Priority: Medium
  - Type: data entry
  - Blocker: cần user cung cấp: client name, amount, currency, issue_date, paid_date
  - Done when: 4 invoice tồn tại trong `invoice_invoices` với đúng billing_entity

- [ ] Verify dữ liệu thực tế cho Accounting Phase 3 (VAT + TNCN)
  - Priority: Medium
  - Type: validation
  - Done when: VatTab và TncnTab hiển thị đúng số liệu từ dữ liệu thực

---

## Doing

_(trống — không có task đang chạy)_

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
