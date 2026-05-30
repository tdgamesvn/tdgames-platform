# DECISIONS

## 2026-05-14 — Project memory will be file-based first
Decision:
- Use repository files as the canonical memory source for this project.
- Defer external/shared memory layers until the codebase and workflow stabilize.

Reason:
- easier to audit
- simpler to maintain
- better suited for project bootstrap

Impact:
- agent must keep `.agent/meta/PROJECT.md`, `.agent/meta/TASKS.md`, and `.agent/meta/LOG.md` updated

---

## 2026-05-14 — Preserve project-agent files outside the application codebase
Decision:
- Keep project-agent operations files under `.agent/meta/` and keep `.agent/WORKFLOW.md` as the workflow entrypoint.

Reason:
- keeps the repository root focused on application code and core project config
- still provides a stable, versioned source of truth for the project agent
- avoids relying only on ephemeral chat/session memory

Impact:
- root stays cleaner
- agent-management files are grouped under `.agent/meta/`
- references must use the new paths consistently

---

## 2026-05-14 — Respect GitNexus guidance before sensitive edits
Decision:
- For future code changes on important symbols, follow the GitNexus workflow documented in `.agent/meta/CLAUDE.md` before editing.

Reason:
- the repository explicitly depends on GitNexus for impact analysis and safe navigation
- reduces risk of broad unintended changes in a non-trivial codebase

Impact:
- project-agent should treat impact analysis as part of the normal edit workflow when changing core functions/classes/methods

---

## 2026-05-29 — Bonus KPI tính vào thu nhập chịu thuế TNCN
Decision:
- Trường `bonus` trong `pay_payroll_records` được đưa vào `taxableIncome` và `grossActual` bên trong `calculatePayroll()`, không cộng thủ công sau thuế.

Reason:
- Tiền thưởng từ HĐLĐ chịu thuế TNCN theo TT 111/2013/TT-BTC Điều 2.
- Cộng sau thuế là sai luật; PIT phải tăng theo lũy tiến khi có bonus.

Impact:
- `PayrollInput` có thêm `bonus?: number`
- `taxableIncome = CB_thực + xăng + ĐT + KPI + bonus`
- `grossActual` bao gồm bonus (không prorate — lump sum cuối tháng)
- Thử việc: bonus split theo `probationRatio` → phần probation 10% flat, phần official lũy tiến

---

## 2026-05-29 — Phụ cấp KPI cố định vs Thưởng KPI biến động
Decision:
- `kpi_allowance`: phụ cấp năng suất **cố định hàng tháng**, cấu hình trong HR salary components, được prorate theo ngày công.
- `bonus`: thưởng KPI **nhập tay cuối tháng**, không prorate, HR nhập trực tiếp trên bảng lương Draft.
- Cả hai đều chịu thuế TNCN.

Reason:
- Hai khoản có bản chất khác nhau (fixed vs discretionary), tách biệt để rõ ràng khi quyết toán.

Impact:
- Đừng nhầm `kpi_allowance` (prorated) với `bonus` (fixed lump sum) khi debug payroll.

---

## 2026-05-14 — Use a dedicated Telegram inbox mapping for tdgames-platforms
Decision:
- Attach a project-specific Telegram inbox configuration to `tdgames-platforms`, but keep file intake manual and operator-triggered.

Reason:
- avoids mixing external files across projects
- keeps a clean mapping between project, bot, chat, and inbox directory
- reduces accidental downloads/imports

Impact:
- Telegram file handling for this project should use `telegram-inbox` with `--project tdgames-platforms`
- no file should be downloaded or imported unless explicitly requested by the operator
