# DECISIONS

## 2026-06-26 — VCB Exchange Rate chỉ hiện trên các app tài chính

Decision:
- Props `vcbRate` / `vcbRateLoading` chỉ truyền vào `<Navbar>` của các app **liên quan tài chính**.
- Các app không tài chính KHÔNG gọi `useExchangeRate()` và KHÔNG truyền props này.

Apps có tỷ giá (finance):
- `invoice`, `expense`, `workforce`, `dashboard`, `accounting`, `payroll`

Apps KHÔNG có tỷ giá:
- `company`, `handbook` (Company Hub), `hr`, `attendance`, `crm`, `portal`, `freelancer-portal`, `ai-agent`, `system-monitor`

Reason:
- Tỷ giá USD→VND không liên quan đến workflow của các app phi tài chính → noise.
- Giữ Navbar gọn, tránh load API VCB thừa.

Impact:
- Khi thêm app mới: kiểm tra xem app có xử lý tiền tệ ngoại tệ không → nếu có mới thêm `useExchangeRate()`.

---

## 2026-06-17 — AI Agent as separate app module, not HR tab

Decision:
- AI Agent is a standalone app module (`apps/ai-agent/`), not a tab within the HR app.

Reason:
- Agents span multiple domains (HR, Finance, Tech, Executive)
- Independent access control (admin + hr roles)
- Will grow into its own feature set (chat, config editor, analytics)

Impact:
- New route `#ai-agent` in the platform
- Separate entry in HomeScreen app grid

---

## 2026-06-17 — LLM via 9Router, not direct API

Decision:
- Use 9Router (`9router.tdgamestudio.com`) as LLM gateway, not direct OpenAI/Anthropic API.

Reason:
- Consolidates LLM credit usage across the company
- Model switching without code changes (just update DB `model` field)
- Already deployed on vps6core as Docker container

Impact:
- Dependency on 9Router uptime (Docker container must be running)
- Model names use provider prefix (e.g. `cx/gpt-5.5`, `skymavis/claude-sonnet-4-6`)
- LLM_API_KEY Supabase secret must match 9Router auth

---

## 2026-06-17 — Edge Function with verify_jwt: false

Decision:
- Deploy `agent-run` edge function with `verify_jwt: false`.

Reason:
- pg_cron triggers via `net.http_post` cannot attach a JWT
- The function is not exposed to end-users directly (manual triggers go through authenticated frontend)

Impact:
- Function is technically callable without auth
- Mitigated by: no destructive actions (read-only + create_insight), rate limiting via pg_cron

---

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

- [2026-07-02] RLS multi-role: dùng `jwt_has_any_role(text[])` / `jwt_roles()` (đọc primary + secondary_roles từ JWT) thay `get_jwt_role() = ANY(...)` cho mọi policy mới.

## 2026-07-12 — Tách 2 sổ công ty toàn hệ thống (full-company-separation)
- `entity` ('TD GAMES' | 'TD CONSULTING') trên 17 bảng gốc mọi module; bảng con kế thừa qua FK/membership — KHÔNG thêm cột entity vào bảng con.
- TD CONSULTING = sổ phụ nội bộ. Tax portal + BHXH đóng cứng sổ gốc TD GAMES. 'Cá nhân' (expense) thuộc sổ TD GAMES.
- Pattern chuẩn: filter client-side tại state hook (matchesWorkspace, reactive); tag insert tại service (getWorkspace đọc localStorage, không cần sửa form). "Hợp nhất" chỉ ở CEO Dashboard.
