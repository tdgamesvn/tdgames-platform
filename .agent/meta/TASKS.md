# TASKS

## To do
- [ ] Review environment requirements and identify all required local variables
  - Priority: High
  - Type: discovery
  - Done when:
    - `.env.local` and any Supabase-related requirements are identified
    - missing secrets/config are listed clearly

- [ ] Inspect application structure under `apps/`, `components/`, and `services/`
  - Priority: High
  - Type: discovery
  - Done when:
    - main modules are mapped
    - data flow and key service boundaries are summarized

- [ ] Verify Supabase local artifacts and serverless function responsibilities
  - Priority: High
  - Type: discovery
  - Done when:
    - `supabase/functions/*` purposes are documented
    - risks for local execution are noted

- [ ] Prepare the first real implementation backlog
  - Priority: Medium
  - Type: planning
  - Done when:
    - at least 5 actionable tasks are derived from the real repository
    - priorities and owners are assigned

## Doing
- [ ] Analyze repository and align project-agent memory with real codebase
  - Started: 2026-05-14
  - Owner: project-agent
  - Notes: imported GitHub repository and updating project memory files

## Review

## Done
- [x] Fix payroll for "lên chính thức giữa tháng" (transition month)
  - Done: 2026-05-16
  - Result: Added `probation_ratio` column; rewrote `calculatePayroll` to handle 3 cases (full probation, full official, transition); BHXH prorated, PIT split (10% flat for probation portion + lũy tiến for official portion); UI shows "CHUYỂN GIAO" badge in PayrollSheet + PaySlip with explainer

- [x] Add HR employment history tracking (official_date + timeline)
  - Done: 2026-05-16
  - Result: Added `official_date` column to hr_employees with backfill; updated `refresh_leave_balances()` to use it; added trigger `trg_hr_employees_track_change` auto-writing to hr_position_history on field changes; created `hr_employee_timeline` view (UNION position_history + salary + contracts + evaluations); added `official_date` input in EmployeeForm and "Lịch sử công tác" tab in EmployeeDetail with iconographic timeline UI

- [x] Debug and restore employee leave request creation in Platforms Attendance
  - Done: 2026-05-16
  - Result: RLS fixed on `leave_balances`, correct accrual logic implemented (fulltime + past probation + 1 day/month), cron monthly refresh + annual April expiry, trigger for used_days deduction, `leave_balance_summary` view live on Supabase

- [x] Bootstrap project-agent structure
  - Done: 2026-05-14
  - Result: standardized project memory and workflow files created

- [x] Import codebase into project root
  - Done: 2026-05-14
  - Result: repository imported from GitHub into `~/Work/apps/tdgames-platforms`

- [x] Attach project-specific Telegram inbox workflow
  - Done: 2026-05-14
  - Result: dedicated inbox path and project mapping created for manual Telegram file intake
