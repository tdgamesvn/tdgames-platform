# CLAUDE.md — tdgames-platforms

> File này được Claude Code đọc tự động mỗi session. Cập nhật khi có thay đổi lớn về kiến trúc, module, hoặc quy trình.

---

## 🏢 Dự án

**tdgames-platforms** — Internal dashboard SPA cho TD Games Company Limited.
- **URL dev:** `http://localhost:3000` (`npm run dev`)
- **URL prod:** `https://app.tdgamestudio.com` (VPS vps6core, auto-deploy qua git push)
- **Brand color:** `#FF9500` | **Background:** `#0F0F0F`
- **Build check:** `npm run build` (bắt buộc trước khi commit)

---

## ⚙️ Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 6.4.x |
| Styling | Tailwind CSS (config trong `index.html`) |
| Backend | Supabase (Auth + PostgreSQL + Edge Functions) — sửa migration/Edge Function: dùng skill `supabase:supabase-postgres-best-practices` trước khi viết SQL |
| File Storage | Cloudflare R2 (`VITE_R2_PUBLIC_URL`) |
| Payment QR | SePay (`VITE_SEPAY_EDGE_FUNCTION_URL`, `VITE_SEPAY_API_KEY`) |
| Email Outreach | Custom Outreach API (`VITE_OUTREACH_API_URL`) |
| LLM Gateway | 9Router (`9router.tdgamestudio.com`) — dùng cho AI Agent |
| Exchange Rate | VCB API live qua `exchangeRateService.ts` |
| PDF Export | jspdf + html2canvas |
| Excel Export | xlsx + file-saver |
| Task Sync | ClickUp API (`clickupService.ts`) |

---

## 🗂️ Kiến trúc

**Single Page Application** — hash routing `#app/tab`, entry `App.tsx`.

### Auth Roles
```typescript
type Role = 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer'
```

### State Machine (App.tsx)
```
getSession()
  ├─ Không có → LoginScreen
  └─ Có →
       ├─ invited_at && !password_set → SetPasswordScreen
       ├─ PASSWORD_RECOVERY → SetPasswordScreen
       ├─ member/freelancer + profile incomplete → ProfileCompletionScreen
       └─ Complete → HomeScreen (hash router)
```

### Cấu trúc thư mục
```
App.tsx            # Root router + auth state machine
types.ts           # ALL shared TypeScript interfaces (chỉ 1 file)
constants.ts       # DEFAULT_INVOICE constant
components/        # Shared components (LoginScreen, Navbar, HomeScreen, Toast...)
services/          # Shared services (supabaseClient, authService, exchangeRate...)
apps/              # Mini-apps (mỗi folder = 1 mini-app độc lập)
supabase/
  functions/       # Edge Functions (Deno)
  migrations/      # SQL migration history (chronological)
.agent/meta/       # Project memory files (không commit changes tại đây)
```

---

## 📱 Mini-Apps (11 apps)

| Route | App | Access | Mô tả |
|-------|-----|--------|-------|
| `#dashboard` | Dashboard | admin | CEO Dashboard — KPI, P&L, trend |
| `#invoice` | Invoice | admin, ke_toan | Hoá đơn, PDF, e-invoice, SePay QR |
| `#expense` | Expense | admin, ke_toan | Chi phí, doanh thu, định kỳ |
| `#workforce` | Workforce | admin, ke_toan | Freelancer, task, settlement, ClickUp |
| `#crm` | CRM | admin, ke_toan | Deal pipeline, BD dashboard, quotation, outreach |
| `#hr` | HR | admin, hr | Nhân viên, phòng ban, change request, evaluation |
| `#attendance` | Attendance | admin, hr | Chấm công, nghỉ phép, báo cáo |
| `#payroll` | Payroll | admin, hr | Bảng lương tháng, công thức, export |
| `#portal` | Portal | member | Employee self-service |
| `#freelancer-portal` | Freelancer Portal | freelancer | Freelancer self-service |
| `#ai-agent` | AI Agent | admin, hr | Chat với AI agents nội bộ, config editor |

### CRM — Các tab hiện có
Dashboard (Tổng quan BD), Clients, Deal Pipeline (Kanban), Quotation (Báo giá), Tài liệu, Thanh toán, Hoạt động, Outreach

### HR Change Request workflow
5 loại: `probation_end`, `salary_change`, `promotion`, `department_transfer`, `termination`
Bảng: `hr_change_requests` — auto-apply khi HR duyệt

### AI Agent
- 9 agents domain (HR, Finance, Tech, Executive...)
- Edge function `agent-run` (verify_jwt: false vì pg_cron trigger)
- LLM qua 9Router, model config trong DB
- Telegram in-app chat + notification badge

---

## 🗄️ Database — Bảng chính theo module

| Module | Bảng chính |
|--------|------------|
| Auth | `auth.users` (user_metadata: role, username, employee_id) |
| HR | `hr_employees`, `hr_departments`, `hr_contracts`, `hr_position_history`, `hr_employee_salary`, `hr_change_requests`, `hr_evaluation_cycles`, `hr_evaluation_submissions` |
| Attendance | `att_monthly_records`, `att_requests` (leave), `att_shifts` |
| Payroll | `pay_payroll_sheets`, `pay_payroll_records`, `pay_payroll_formula_settings` |
| Leave | `leave_balances` (accrual 1 ngày/tháng cho fulltime official), `leave_balance_summary` (view) |
| Invoice | `invoice_invoices`, `invoice_line_items` |
| Expense | `expense_expenses`, `expense_categories`, `expense_recurring` |
| Workforce | `workforce_workers`, `workforce_tasks`, `workforce_settlements` |
| CRM | `crm_clients`, `crm_deals`, `crm_activities`, `crm_quotations`, `crm_outreach_leads`, `crm_email_templates`, `crm_discovered_studios` |
| Accounting | `finance_bank_accounts`, `acc_savings`, `acc_loans` |
| AI Agent | `ai_agents`, `ai_agent_insights`, `ai_conversations` |

---

## 🔧 Edge Functions (Supabase)

| Function | Mô tả |
|----------|-------|
| `agent-run` | Trigger AI agent chạy + tạo insights |
| `billing-report` | Export báo cáo billing |
| `create-employee-auth` | Tạo auth khi invite nhân viên |
| `notify-email` | Email notification (eval, payslip, change request) |
| `outreach-auto-batch` | Gửi email outreach theo batch |
| `outreach-proxy` | Proxy gửi email outreach đơn lẻ |
| `platform-data` | API data cho CEO Dashboard |

**pg_cron jobs:** refresh-leave-balances (monthly), expire-leave-balances (1/4 hàng năm), AI agent runs (scheduled), email reminders

---

## 💰 Payroll Formula (calculatePayroll)

```
1. ratio = workDays / standardWorkDays (thường 22)
2. grossActual = (tất cả khoản × ratio) + extraOT + bonus
3. BHXH NV = baseSalary × 10.5% × officialRatio  |  CT = baseSalary × 21.5% × officialRatio
4. taxableIncome = (CB + xăng + ĐT + KPI + bonus) × ratio  [ăn trưa + trang phục + OT: miễn thuế]
5. Probation split: probation portion → 10% flat PIT; official portion → lũy tiến
6. assessable = taxableOfficial - BHXH - 15.5M (bản thân) - 6.2M × NPT
7. PIT lũy tiến 7 bậc (TT 111/2013)
8. netSalary = grossActual - BHXH_NV - PIT
```

**Key:** `bonus` (nhập tay, không prorate, chịu thuế) ≠ `kpi_allowance` (cố định, prorate, chịu thuế)

---

## 🎨 UI/UX — Bắt buộc đọc trước khi viết component

**PHẢI đọc `.agent/meta/STYLE_GUIDE.md` trước khi viết hoặc sửa bất kỳ UI component nào.**

Tóm tắt nhanh:
- **Font:** Montserrat (`font-black` = weight 900)
- **Colors:** `bg-bg` (#0F0F0F), `bg-surface` (#1A1A1A), `text-primary`/`bg-primary` (#FF9500)
- **Buttons:** 3 tiers — Primary (bg-primary), Secondary (border-white/10), Ghost (no border)
- **Cards:** `bg-surface border border-white/8 rounded-xl`
- **Inputs:** `bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2`
- **Badges:** `text-[10px] font-black uppercase` — 4 colors: success/error/warning/info
- **KPI labels:** `text-[10px] font-black text-neutral-600 uppercase tracking-wider`
- **KPI values:** `text-2xl font-black`
- **Không dùng `max-w-*` trong tab/page component** (parent `max-w-[1400px]` lo)
- **Không tự bịa pattern mới** — extend STYLE_GUIDE.md trước

---

## 📋 Multi-role Support

Users có thể có `primary role` + `secondary_roles[]`.
- Helpers: `hasRole(user, role)`, `hasAnyRole(user, roles)`, `getUserRoles(user)`
- File: `utils/roleUtils.ts` (hoặc tương tự)
- Edge function `check_email` trả về `secondary_roles`
- UI toggle secondary roles trong `EmployeeDetail`

---

## 🔑 Env Variables

| Biến | Dùng cho |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_SEPAY_EDGE_FUNCTION_URL` | SePay QR payment |
| `VITE_SEPAY_API_KEY` | SePay API key |
| `VITE_R2_PUBLIC_URL` | Cloudflare R2 public URL |
| `VITE_OUTREACH_API_URL` | Outreach email API |

---

## ✅ Quy trình trước khi commit

1. GitNexus `detect_changes({scope: "compare", base_ref: "main"})` — xác nhận đúng phạm vi thay đổi
2. `npm run build` — bắt buộc pass
3. Skill `/verify` hoặc `/run` nếu có sửa UI/luồng người dùng — xác nhận chạy thật trên localhost:3000
4. Skill `/code-review` cho diff trước khi tạo PR/commit lớn

---

## 📚 Memory Protocol

Sau mỗi session có code thay đổi, PHẢI cập nhật:
- `.agent/meta/TASKS.md` — chuyển task Doing → Done, thêm task mới
- `.agent/meta/LOG.md` — append dated entry với work done + validation
- `.agent/meta/DECISIONS.md` — chỉ khi có quyết định kỹ thuật lâu dài

**Không commit** `.agent/meta/`, `MEMORY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `IDENTITY.md`, `HEARTBEAT.md`

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **tdgames-platform** (4320 symbols, 8609 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/tdgames-platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/tdgames-platform/clusters` | All functional areas |
| `gitnexus://repo/tdgames-platform/processes` | All execution flows |
| `gitnexus://repo/tdgames-platform/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
