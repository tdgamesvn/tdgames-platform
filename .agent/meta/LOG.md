# LOG

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
