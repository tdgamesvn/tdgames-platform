# PROJECT.md — tdgames-platforms

_Cập nhật: 2026-06-25_

---

## Tổng quan

**tdgames-platforms** là một nền tảng nội bộ (internal dashboard) cho công ty TD Games. Một React SPA duy nhất chứa nhiều mini-app theo role, tất cả build bằng Vite.

- **Công ty:** TD GAMES COMPANY LIMITED
- **Địa chỉ:** Xom Ngoai, Dong Anh Commune, Hanoi City, Vietnam
- **Email:** tdgames.vn@gmail.com
- **MST:** 0111386856
- **URL dev:** http://localhost:3000
- **Brand color:** `#FF9500` (orange/primary)
- **Background:** `#0F0F0F` (near-black dark theme)

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 6.4.x |
| Styling | Tailwind CSS |
| Backend | Supabase (Auth + PostgreSQL + Edge Functions) |
| File Storage | Cloudflare R2 (public URL via `VITE_R2_PUBLIC_URL`) |
| Payment QR | SePay (`VITE_SEPAY_EDGE_FUNCTION_URL`, `VITE_SEPAY_API_KEY`) |
| Email Outreach | Custom Outreach API (`VITE_OUTREACH_API_URL`) |
| Exchange Rate | VCB API (live USD/VND rate via `exchangeRateService.ts`) |
| PDF Export | jspdf + html2canvas |
| Excel Export | xlsx + file-saver |
| Task Sync | ClickUp API (`clickupService.ts`) |
| Code Index | GitNexus (4100 symbols, 6473 relationships) |

---

## Cấu trúc thư mục

```
tdgames-platforms/
├── App.tsx                  # Root router + auth state machine
├── index.tsx                # ReactDOM entry
├── types.ts                 # All shared TypeScript interfaces
├── constants.ts             # DEFAULT_INVOICE constant
├── components/              # Shared/auth screens
│   ├── LoginScreen.tsx
│   ├── SetPasswordScreen.tsx
│   ├── ProfileCompletionScreen.tsx
│   ├── HomeScreen.tsx
│   ├── Navbar.tsx
│   ├── AppBackground.tsx
│   └── ToastNotification.tsx
├── services/                # Shared services
│   ├── supabaseClient.ts    # Supabase client singleton
│   ├── authService.ts       # Login logic
│   ├── exchangeRateService.ts
│   └── ExchangeRateContext.tsx  # React Context cho VCB rate
├── apps/                    # Mini-apps theo chức năng
│   ├── dashboard/           # CEO Dashboard
│   ├── invoice/             # Quản lý hoá đơn
│   ├── expense/             # Quản lý chi phí
│   ├── workforce/           # Quản lý freelancer/task
│   ├── crm/                 # CRM - khách hàng & outreach
│   ├── hr/                  # Nhân sự fulltime
│   ├── attendance/          # Chấm công
│   ├── payroll/             # Bảng lương
│   ├── portal/              # Employee self-service portal
│   ├── freelancer-portal/   # Freelancer self-service portal
│   ├── ai-agent/            # AI Agent chat + insights
│   └── company/             # Hồ sơ công ty + tài liệu pháp lý
├── supabase/
│   ├── functions/           # Edge Functions (Deno)
│   └── migrations/          # SQL migration history
└── docs/                    # Tài liệu dự án
```

---

## Auth Flow

### Roles
```typescript
type Role = 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer'
```

- `admin` → full access tất cả apps
- `ke_toan` → invoice, expense, workforce, crm
- `hr` → hr, attendance, payroll, portal
- `member` → portal (employee self-service)
- `freelancer` → freelancer-portal

### State Machine (App.tsx)
```
Khởi động
  ↓ supabase.auth.getSession()
  ├─ Không có session → LoginScreen
  └─ Có session →
       ├─ invited_at && !password_set → SetPasswordScreen (onboarding step 1)
       ├─ PASSWORD_RECOVERY event → SetPasswordScreen
       ├─ role=member/freelancer + employee_id + profile incomplete → ProfileCompletionScreen (step 2)
       └─ Authenticated & complete → HomeScreen (router)
```

### Invite Flow
1. Admin invite user qua Supabase → email với magic link
2. User click link → `SIGNED_IN` event với `invited_at` set
3. `SetPasswordScreen` → user set password → update `user_metadata.password_set = true`
4. `ProfileCompletionScreen` → điền đủ thông tin cá nhân
5. Redirect về portal tương ứng (portal / freelancer-portal)

### Hash Router
URL hash dạng `#app/tab`, ví dụ `#workforce/tasks`
- VALID_APPS: dashboard, invoice, expense, workforce, crm, hr, attendance, payroll, portal, freelancer-portal, ai-agent, company
- Back button → HomeScreen (xoá hash)

---

## Các Mini-App

### 1. Dashboard (`/apps/dashboard`)
- **Route:** `#dashboard`
- **Access:** admin
- **Chức năng:** CEO Dashboard — KPI tháng, P&L, trend chart, alerts
- **Data:** `fetchCeoDashboard(month, year)` từ `dashboardService`
- **Components:** `DashboardApp`, `TrendChart`, `PlTable`

### 2. Invoice (`/apps/invoice`)
- **Route:** `#invoice`
- **Access:** admin, ke_toan
- **Chức năng:** Tạo, quản lý hoá đơn; xuất PDF; e-invoice; gửi email; QR payment SePay
- **Tabs:** history (danh sách), dashboard (tổng quan), editor (tạo mới), activity (log), recurring (định kỳ)
- **Services:** `invoiceService`, `sePayService`, `emailModal`
- **Features nổi bật:**
  - E-invoice integration (draft → issued → PDF)
  - Email modal gửi invoice
  - Recurring invoice
  - Multi-currency (USD/VND) với live VCB rate
  - Dark/light theme toggle

### 3. Expense (`/apps/expense`)
- **Route:** `#expense`
- **Access:** admin, ke_toan
- **Chức năng:** Theo dõi chi tiêu, doanh thu, chi phí định kỳ, báo cáo
- **Tabs:** dashboard, danh sách, định kỳ, danh mục, báo cáo
- **Types:** `ExpenseRecord`, `RecurringExpense`, `ExpenseCategory`
- **Note:** phân loại `type: 'expense' | 'revenue'`, `source_type: 'payroll' | 'settlement' | 'invoice' | 'manual'`

### 4. Workforce (`/apps/workforce`)
- **Route:** `#workforce`
- **Access:** admin, ke_toan
- **Chức năng:** Quản lý freelancer/worker, task, nghiệm thu, settlement, tổng quan tài chính
- **Tabs:** Nhân sự, Task, Nghiệm thu (Settlement), NT Dự Án (ProjectAcceptance), Tổng Quan, Cấu hình
- **Services:** `workforceService`, `clickupService`, `projectAcceptanceService`, `dashboardService`
- **Sub-folders:** `components/settlement/`, `components/acceptance/`, `components/shared/`, `hooks/`, `services/`
- **Features nổi bật:**
  - ClickUp sync (task import từ ClickUp)
  - Settlement PDF export
  - Project Acceptance (nghiệm thu theo dự án)
  - Multi-currency với exchange rate
  - Financial dashboard

### 5. CRM (`/apps/crm`)
- **Route:** `#crm`
- **Access:** admin, ke_toan
- **Chức năng:** Quản lý khách hàng, deal pipeline, báo giá, outreach email
- **Default tab:** `dashboard` (BD Dashboard)
- **Tabs:** Tổng quan (BD Dashboard), Clients, Deal Pipeline (Kanban), Quotation (Báo giá), Tài liệu, Thanh toán, Hoạt động, Outreach
- **Types:** `CrmClient`, `CrmDeal`, `CrmQuotation`, `CrmActivity`, `CrmOutreachLead`, `CrmEmailTemplate`, `CrmDiscoveredStudio`
- **Features nổi bật:**
  - **BD Dashboard**: KPI (Pipeline/Won/WinRate/Clients), pipeline funnel, deals needing attention (overdue/stale), per-BD performance table, recent activities sidebar
  - **Deal Pipeline**: Kanban board 7 stages (Lead→Won/Lost), drag-drop, tabbed detail panel, inline edit, stage transition rules (Won→auto close_date, Lost→require reason), filters (stage/owner/currency), days-in-stage badge
  - **Quotation**: line items (desc/qty/unit/price), auto subtotal, validity period, status flow (draft→sent→accepted/rejected), auto QT-YYYYMM-NNN number
  - **Follow-up**: next_follow_up date per deal (card indicator, detail panel, dashboard section)
  - **Client Ownership**: assigned_bd per client
  - Email outreach tự động (3 bước: initial, followup1, followup2), Apollo discovery, hiring signal pipeline
  - Activity timeline per client; Payment tracker

### 6. HR (`/apps/hr`)
- **Route:** `#hr`
- **Access:** admin, hr
- **Chức năng:** Quản lý nhân viên fulltime/freelancer, phòng ban, nhắc việc, đánh giá, đề xuất nhân sự
- **Tabs:** Nhân sự, Thêm/Sửa, Phòng ban, Nhắc việc, Đề xuất, Đánh giá
- **Types:** `HrEmployee`, `HrDepartment`, `HrContract`, `HrEquipmentHandover`, `HrChangeRequest`, `HrEvaluationCycle`, `HrEvaluationSubmission`, `HrReminder`
- **Features nổi bật:**
  - Employee types: fulltime, freelancer, parttime
  - Thông tin xe nhân viên inline trong profile (vehicle_type, license_plate, brand, color)
  - Biên bản bàn giao tài sản (PDF ký)
  - **Change Request workflow**: 5 loại đề xuất (probation_end, salary_change, promotion, department_transfer, termination) → HR tạo → admin duyệt → auto-apply (salary/position/department)
  - **Evaluation (Đánh giá)**: HR tạo cycle với deadline → NV tự đánh giá qua Portal → leader nộp → gap check → 1-on-1 nếu gap > 1.0 → completed; email noti tự động
  - Inline salary edit trên ChangeRequestTab (pending + approved)
  - Position history timeline
  - Reminder dashboard (hợp đồng, sinh nhật, đánh giá...)

### 7. Attendance (`/apps/attendance`)
- **Route:** `#attendance`
- **Access:** admin, hr
- **Chức năng:** Chấm công, ca làm việc, báo cáo, duyệt nghỉ phép
- **Tabs:** Dashboard, Bảng công, Ca làm việc, Báo cáo, Nghỉ phép
- **Types:** `AttMonthlyRecord`, `AttMonthlySheet`, `HrLeaveRequest`

### 8. Payroll (`/apps/payroll`)
- **Route:** `#payroll`
- **Access:** admin, hr
- **Chức năng:** Bảng lương theo tháng, công thức lương, xác nhận, đánh dấu đã trả
- **Views:** danh sách sheets, chi tiết sheet, công thức lương
- **Types:** `PayPayrollRecord`, `PayPayrollSheet`
- **Features:** `payrollFormulaService` — công thức lương cấu hình được

### 9. Portal (`/apps/portal`)
- **Route:** `#portal`
- **Access:** member (employee self-service)
- **Chức năng:** Xem thông tin công ty, bảng lương cá nhân, chấm công, nghỉ phép, gửi xe, hồ sơ
- **Tabs:** Thông tin công ty, Bảng lương, Chấm công, Nghỉ phép, Gửi xe, Hồ sơ
- **Services:** `portalService` (fetchMyProfile, fetchMyPayslips, fetchMyAttendance, fetchEmployeeDirectory)

### 10. Freelancer Portal (`/apps/freelancer-portal`)
- **Route:** `#freelancer-portal`
- **Access:** freelancer
- **Chức năng:** Dashboard cá nhân, task list, nghiệm thu, hồ sơ
- **Tabs:** Dashboard, Tasks, Nghiệm thu, Hồ sơ
- **Services:** `freelancerPortalService`

### 11. AI Agent (`/apps/ai-agent`)
- **Route:** `#ai-agent`
- **Access:** admin, hr
- **Chức năng:** Chat với AI agents nội bộ, xem insights, manage agents
- **Tabs:** Feed (unified insights), CHRO, CFO, CTO, BD, Cài đặt (config editor)
- **4 active agents**: CHRO (HR), CFO (Finance), CTO (Tech), BD (Business Dev)
- **Features nổi bật:**
  - In-app chat với từng agent (Telegram-style UI)
  - Unified Feed view: tất cả insights từ mọi agent, filter by agent/status
  - Agent Config Editor: edit model/temperature/personality/emoji/is_active
  - Notification badge (red dot) trên HomeScreen khi có insights mới
  - pg_cron scheduled runs: 08:30–09:00 VN, Mon–Fri
  - Edge function `agent-run` (verify_jwt: false — pg_cron trigger)
  - LLM qua 9Router (`9router.tdgamestudio.com`)

### 12. Company (`/apps/company`)
- **Route:** `#company`
- **Access:** admin, ke_toan
- **Chức năng:** Hồ sơ công ty, ngân hàng, tài liệu pháp lý
- **Tabs:** Thông tin, Ngân hàng, Tài liệu
- **Features nổi bật:**
  - View/edit legal info (MST, địa chỉ, người đại diện, ngày hoạt động)
  - Upload tài liệu (PDF/ảnh/doc) lên Supabase Storage bucket `company-documents`
  - Signed URL viewer 1h
  - Entity switcher nếu nhiều pháp nhân (TD GAMES / TD CONSULTING)
  - Bank accounts từ `finance_bank_accounts`

---

## Supabase Edge Functions

| Function | Mô tả |
|----------|-------|
| `agent-run` | Trigger AI agent chạy + tạo insights; verify_jwt: false (pg_cron) |
| `billing-report` | Xuất báo cáo billing |
| `create-employee-auth` | Tạo auth user khi invite nhân viên; update_secondary_roles action |
| `notify-email` | Email notification (eval, payslip, change request, eval deadlines) |
| `outreach-auto-batch` | Gửi email outreach tự động theo batch |
| `outreach-proxy` | Proxy gửi email outreach đơn lẻ |
| `platform-data` | API data tổng hợp cho CEO Dashboard |

**pg_cron jobs (7 active):**
- `refresh-leave-balances` — monthly accrual 1 ngày/tháng cho fulltime official
- `expire-leave-balances` — 1/4 hàng năm expire unused balances
- `eval-deadline-reminder` — 01:00 UTC (08:00 VN) daily — nhắc NV 1 ngày trước deadline eval
- `ai-agent-*` — CHRO/CFO/CTO/BD runs 08:30–09:00 VN Mon–Fri
- `outreach-auto-discovery` — 02:00 UTC — Apollo discovery per country rotation

---

## Multi-role Support

Users có thể có `primary role` + `secondary_roles[]`:
- Helpers: `hasRole(user, role)`, `hasAnyRole(user, roles)`, `getUserRoles(user)` — file `utils/roleUtils.ts`
- `authService.ts` parse `secondary_roles` từ `user_metadata`
- Edge function `create-employee-auth` → `update_secondary_roles` action; `check_email` trả về `secondary_roles`
- Toggle secondary roles UI trong `EmployeeDetail` (HR app)
- **Backward compatible**: user chỉ có primary role vẫn hoạt động bình thường

---

## Database Migrations (chronological)

Migrations gần đây nhất:
- `20260509` — Security: revoke public execute on sensitive RPCs; payroll formula settings
- `20260510` — HR: equipment handover, signed PDF
- `20260513` — Invoice: revenue sync
- `20260529` — Payroll: bonus (KPI thưởng) field
- `20260531` — Outreach: trigger_source + lead_score
- `20260603` — Payroll: standard_work_days (dynamic T2-T6), bonus_reason, exclude_from_payroll
- `20260608` — Evaluation: hr_evaluation_cycles + hr_evaluation_submissions; deadline column; pg_cron eval reminder
- `20260612` — Payroll: pre_official_base_salary (mid-month proration)
- `20260617` — HR: hr_change_requests (5 types, auto-apply); AI Agent: 6 tables (ai_agents, runs, insights, episodes, knowledge, conversations)
- `20260618` — HR: vehicle fields inline (vehicle_type/plate/brand/color on hr_employees)
- `20260622` — HR: secondary_roles support
- `20260625` — CRM: next_follow_up on crm_deals; assigned_bd on crm_clients; crm_quotations table
- `20260701` — CRM: crm_quotations (items JSONB, status, RLS, indexes)

---

## Shared Services

### `supabaseClient.ts`
- Export `supabase` singleton
- ⚠️ Bị import cả static lẫn dynamic → build warning (không critical)

### `authService.ts`
- `loginWithCredentials(username, password)` → lookup `username` trong `user_metadata`, login bằng email
- Role whitelist trong App.tsx: `['admin', 'ke_toan', 'hr', 'member', 'freelancer']`

### `ExchangeRateContext.tsx`
- React Context cung cấp `rate` (VCB USD/VND), `avgUsdVnd`, `loading`
- Được wrap toàn app qua `ExchangeRateProvider`

### `exchangeRateService.ts`
- Fetch tỉ giá VCB (live)
- `avgRate()` → tỉ giá trung bình mua/bán

---

## Env Variables

| Biến | Dùng cho |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_SEPAY_EDGE_FUNCTION_URL` | SePay QR payment endpoint |
| `VITE_SEPAY_API_KEY` | SePay API key |
| `VITE_R2_PUBLIC_URL` | Cloudflare R2 public base URL |
| `VITE_OUTREACH_API_URL` | Outreach email API URL |

---

## Các vấn đề đã ghi nhận

| Vấn đề | Mức độ | Ghi chú |
|--------|--------|---------|
| `supabaseClient.ts` import mixed static/dynamic | Low | Build warning, không crash |
| Bundle size ~1.7MB | Medium | Có thể tách code-split sau |
| 6 npm vulnerabilities | Low | Chưa cần xử lý ngay |
| `freelancer` role trong `ProfileCompletionScreen` | Fixed | Đã được thêm vào VALID_ROLES trong App.tsx |

---

## Domain Knowledge — Payroll

### Công thức tính lương (8 bước) — `calculatePayroll()` trong `payrollService.ts`

```
1. ratio = workDays / standardWorkDays (thường 22)
2. grossActual = (tất cả khoản × ratio) + extraOT + bonus
   grossRef    = tổng khoản full tháng (không prorate, không bonus)
3. BHXH NV = baseSalary × 10.5% × officialRatio (probation: không đóng)
   BHXH CT = baseSalary × 21.5% × officialRatio
4. taxableIncome = (CB + xăng + ĐT + KPI + bonus) × ratio
   KHÔNG chịu thuế: ăn trưa, trang phục, tăng ca
5. Probation split (probationRatio 0-1):
   - taxableProbation = taxableIncome × probationRatio → PIT 10% flat
   - taxableOfficial  = taxableIncome × officialRatio → PIT lũy tiến
6. assessable = taxableOfficial - BHXH - 15.5M (bản thân) - 6.2M×NPT
7. PIT lũy tiến theo bậc (Thông tư 111/2013)
8. netSalary = grossActual - BHXH_NV - PIT
   totalCompanyCost = grossActual + BHXH_CT
```

**Key rules:**
- `bonus` (thưởng KPI nhập tay) → tính vào TNCT, KHÔNG prorate
- `kpi_allowance` (phụ cấp KPI cố định từ HR) → tính vào TNCT, CÓ prorate
- OT phát sinh (`extra_ot_hours`) → tính vào gross, KHÔNG chịu thuế
- Bảng lương: Draft → Confirmed (lock + sync expense) → Paid

### Các bảng DB chính của Payroll

| Bảng | Vai trò |
|------|---------|
| `pay_payroll_sheets` | Bảng lương theo tháng (month, year, status) |
| `pay_payroll_records` | Từng dòng nhân viên trong sheet |
| `pay_payroll_formula_settings` | Thông số công thức (thuế, BH, ngày chuẩn) |
| `hr_employee_salary` | Khoản lương từng NV (linked qua `hr_salary_components.name`) |
| `att_monthly_records` | Ngày công + OT → pull vào khi tạo bảng lương |

### Salary components name mapping (SALARY_NAME_MAP)
```
'Lương cơ bản'          → base_salary
'Phụ cấp ăn trưa'       → lunch_allowance   (không chịu thuế)
'Phụ cấp xăng xe'       → transport_allowance
'Phụ cấp điện thoại'    → phone_allowance
'Phụ cấp trang phục'    → clothing_allowance (không chịu thuế)
'Phụ cấp năng suất (KPI)' → kpi_allowance
'Tăng ca'               → default_ot        (không chịu thuế)
```

---

## Workflow phát triển

1. Đọc AGENTS.md + PROJECT.md + TASKS.md trước khi bắt đầu
2. Dùng Claude Code cho mọi coding work
3. Chạy `gitnexus_impact` trước khi sửa function/class/method quan trọng
4. Dev server: `npm run dev` → http://localhost:3000
5. Build check: `npm run build`
6. Không commit `.agent/meta/`, `MEMORY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `IDENTITY.md`, `HEARTBEAT.md`
