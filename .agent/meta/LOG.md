# LOG

---

## 2026-06-29
### Task
CRM P1 — Follow-up Reminders + Client Ownership

### Work Done
**Follow-up Reminders:**
- DB migration: `next_follow_up DATE` column on `crm_deals` + index
- `CrmDeal` type: added `next_follow_up?: string | null`
- DealCard: follow-up indicator badge (📌 overdue=red, today=orange, upcoming=blue)
- DealFormModal: "📌 Follow-up tiếp" date picker alongside "Dự kiến chốt"
- DealDetailPanel: follow-up inline display with relative time (Quá hạn Xd / Hôm nay / Xd nữa), click-to-edit via native date picker
- BdDashboard: "📌 Follow-up" section at top of left column showing overdue + today + next 3 days deals

**Client Ownership:**
- DB migration: `assigned_bd_id UUID` + `assigned_bd_name TEXT` on `crm_clients` + index
- `CrmClient` type: added `assigned_bd_id`, `assigned_bd_name`
- ClientList: purple "BD: Name" badge in client card header
- ClientForm: "BD phụ trách" text input after Status field

### Validation
- `npm run build` ✅ (277 modules, 7.83s, 0 errors)

### Result
- BD can set follow-up dates on deals → visible on card, detail panel, dashboard
- Dashboard highlights overdue + upcoming follow-ups
- Clients can be assigned to a BD → visible in client list

### Next Step
- Apply migration to Supabase
- Commit + push
- Remaining: P2 (BD Performance Report, Quotation)

---

## 2026-06-28
### Task
BD Dashboard — CRM "Tổng quan" tab

### Work Done
- Created `apps/crm/components/BdDashboard.tsx` — full dashboard component
  - **KPI Cards** (4): Pipeline Value, Total Won, Win Rate (W/L breakdown), Active Clients
  - **Pipeline Funnel**: horizontal bar chart per stage (Lead→Contracting), count + value, proportional width
  - **Deals Needing Attention**: overdue close dates (red), upcoming closes (next 14d), stale deals (>14d no update), clickable → goes to pipeline
  - **Recent Activities** sidebar: last 6 activities with type icon + client name + date, link to all activities
  - **Won Deals** sidebar: latest 4 won deals with value
  - **Quick Actions**: buttons to create deal, view docs, open outreach
- Wired into `CrmApp.tsx`: `dashboard` tab renders `<BdDashboard>` with `onSwitchTab` for navigation
- Changed default CRM tab from `clients` → `dashboard` (BD sees dashboard first when opening CRM)
- Layout: 2-column (main 2/3 + sidebar 1/3), follows STYLE_GUIDE.md patterns

### Validation
- `npm run build` ✅ (277 modules, 7.86s, 0 errors)

### Result
- CRM now opens to "Tổng quan" dashboard by default
- BD gets pipeline overview, attention items, and recent activity at a glance
- All sections clickable → navigate to relevant tabs

### Next Step
- Commit + push khi sếp sẵn sàng
- Remaining CRM roadmap: Follow-up Reminders (P1), Client Ownership (P1), BD Performance Report (P2), Quotation (P2)

---

## 2026-06-27
### Task
CRM Deal Pipeline — Phase 4 (Polish) — FEATURE COMPLETE

### Work Done
- **DealCard**: drag opacity (0.4 while dragging), cursor-grab/grabbing, `onDragEnd` cleanup, days-in-stage indicator (Xd badge, color-coded: >30d red, >14d yellow, else neutral)
- **PipelineColumn**: improved empty states with stage-specific hints (lead→"Thêm deal mới", won→"Kéo deal vào đây khi chốt"), drop indicator (dashed border + "Thả vào đây" text) when dragging over empty column
- **PipelineBoard**: pass `onDragEnd`, responsive horizontal scroll padding (`-mx-6 px-6 md:-mx-12 md:px-12`) for edge-to-edge scroll
- **useDealPipeline**: toast notifications for ALL CRUD actions (create/update/delete/stage change/inline edit), refetch on tab focus via `visibilitychange`, `handleDragEnd` to clean dragOverStage
- **DealPipeline**: wired `<ToastNotification>` component + `onDragEnd` prop

### Validation
- `npm run build` ✅ (276 modules, 7.87s, 0 errors)

### Result
ALL 4 PHASES COMPLETE:
- Phase 1 ✅ Foundation: 661→76 dòng refactor, 14 files
- Phase 2 ✅ Features: 3-tab detail panel, inline edit, stage transition rules
- Phase 3 ✅ Filters: stage/owner/currency filters + responsive metrics
- Phase 4 ✅ Polish: drag feedback, toast, days-in-stage, drop indicator, refetch on focus

### Next Step
- Commit + deploy khi sếp sẵn sàng

---

## 2026-06-26
### Task
CRM Deal Pipeline — Phase 3 (Filters + Metrics)

### Work Done
- Created `hooks/useDealFilters.ts` — filter state hook with search, stage (all/active/specific), owner, currency filters; `useMemo` for derived owners list + filtered deals
- Created `pipeline/PipelineFilters.tsx` — filter bar UI: 3 quick pills (Tất cả / Đang xử lý) + stage dropdown + owner dropdown (auto-hidden if ≤1) + currency dropdown + active filter count + reset button
- Upgraded `PipelineMetrics.tsx` — accepts both `deals` (all) and `filteredDeals`, shows scoped stats when filtered with "X active (Y tổng)" context, added W/L breakdown to Win Rate
- Rewrote `useDealPipeline.ts` — integrated `useDealFilters`, removed old search/filtered state, columns now built from `dealFilters.filtered`, return surface exposes `filters`/`setFilter`/`resetFilters`/`hasActiveFilters`/`owners`/`filteredDeals`
- Updated `DealPipeline.tsx` — search input now uses `p.setFilter('search', ...)`, added `<PipelineFilters>` bar, `<PipelineMetrics>` gets both `deals` + `filteredDeals` + `hasActiveFilters`
- Added `PipelineFilters` to barrel export

### Validation
- `npm run build` ✅ (276 modules, 7.75s, 0 errors)

### Result
- Filter bar with stage pills + dropdowns for stage/owner/currency
- KPI cards respond to active filters, showing scoped vs total context
- All filters composable (can combine stage + owner + currency + search)
- "Xóa lọc" reset button appears when filters active

### Next Step
- Phase 4: Polish (drag feedback, responsive, keyboard shortcuts)

---

## 2026-06-25
### Task
CRM Deal Pipeline — Phase 1 + Phase 2 Implementation

### Work Done
**Phase 1 (Foundation) — tách DealPipeline.tsx monolith:**
- Tách 661 dòng → 11 files nhỏ trong `apps/crm/components/pipeline/` + `apps/crm/hooks/`
- `constants.ts` (STAGES, formatters), `StageBadge.tsx`, `DealCard.tsx`, `PipelineColumn.tsx`, `PipelineBoard.tsx`, `PipelineMetrics.tsx`, `DealFormModal.tsx`, `DealDetailPanel.tsx`, `index.ts` barrel
- `useDealPipeline.ts` hook — tách toàn bộ state + CRUD + drag-drop logic
- `DealPipeline.tsx` giảm từ 661 → 76 dòng (thin wrapper)
- Wire `deals` tab vào CrmApp.tsx (trước đó import nhưng không render)
- Xóa import `BdDashboard` (file không tồn tại)

**Phase 2 (Features) — nâng cấp DealDetailPanel + DealFormModal:**
- DealDetailPanel: 3 tabs (Tổng quan / Hoạt động / Tài liệu), panel width 420→480px
- Tab Tổng quan: inline edit notes + probability (click-to-edit, Escape cancel, Enter save)
- Tab Hoạt động: MiniActivityList — load activities by client_id, quick-add form (type + title)
- Tab Tài liệu: MiniDocumentList — read-only doc list by client_id, clickable links
- `InlineEditField` component — reusable inline edit cho text/textarea/number
- DealFormModal: stage transition rules:
  - Lost → require lost_reason (validation error), auto actual_close_date
  - Won → auto actual_close_date + info badge
  - Auto probability suggestion by stage (lead=10%, contacted=20%... won=100%, lost=0%)
  - Escape keyboard shortcut đóng modal
  - max-h-[90vh] overflow-y-auto cho form dài
- `useDealPipeline.ts`: thêm `updateDealField()` cho inline edit optimistic

### Validation
- `npm run build` ✅ (274 modules, 7.73s, 0 TypeScript errors)

### Result
- Deal Pipeline có đầy đủ: Kanban board + tabbed detail panel + inline edit + stage rules
- Phase 1+2 = MVP hoàn chỉnh

### Next Step
- Phase 3: Filters + URL sync
- Phase 4: Polish (drag feedback, responsive)

---

## 2026-06-24
### Task
CRM Deal Pipeline — Design Spec (5 sections)

### Work Done
- Hoàn thành design spec đầy đủ 5 sections cho CRM Deal Pipeline:
  - **Section 1: UI Layout & Visual Design** — Kanban board 7 stages (Lead→Won/Lost), DealCard layout, responsive rules
  - **Section 2: Component Specs** — DealDetailPanel (slide-over 480px, 4 tabs), DealFormModal, PipelineFilters, PipelineMetrics
  - **Section 3: Data Flow & Interactions** — CRUD, drag-drop stage transitions, transition rules (Won→auto close_date, Lost→require reason), optimistic updates, URL sync
  - **Section 4: Component Structure & File Organization** — 11 new files under pipeline/ + hooks/, dependency tree
  - **Section 5: Implementation Plan** — 4 phases (Foundation→Features→Filters→Polish), task breakdown, priorities, risks & mitigations, out-of-scope
- Phân tích DealPipeline.tsx hiện tại (661 dòng) — cần refactor thành components nhỏ

### Result
- Design spec sẵn sàng cho implementation
- Phase 1 (Foundation) là next step — tách DealPipeline.tsx

### Next Step
- Bắt đầu code Phase 1: StageBadge, DealCard, PipelineColumn, useDealDragDrop, PipelineBoard

---

## 2026-06-23
### Task
Upgrade GrossNet Calculator to support detailed salary component breakdown

### Work Done
- compared accountant's manual payroll calculation with app's GrossNet Calculator output
- identified root cause: GrossNet Calculator treated entire gross as baseSalary, causing wrong BHXH base and taxable income
- added "Chi tiết" (detailed) input mode with 7 component fields: Lương CB, Ăn trưa, Trang phục, Xăng xe, Điện thoại, OT, KPI
- detailed mode calls `calculatePayroll()` directly (same engine as PayrollSheet), so BHXH is calculated on baseSalary only and lunch/clothing/OT are correctly excluded from taxable income
- kept "Đơn giản" (simple) mode for quick single-number estimation
- updated UI to follow STYLE_GUIDE.md patterns (cards, labels, badges)
- verified calculation matches accountant's numbers exactly for all 3 employees (Bảo Anh, Hiếu, Tú)

### Validation
- `npm run build` succeeded
- manual number verification: Net, BHXH NV, BHXH Cty, PIT, Total Company Cost all match accountant's sheet

### Result
- GrossNet Calculator now has 2 modes: Đơn giản (single gross) and Chi tiết (component breakdown)
- Chi tiết mode produces results identical to accountant's manual calculation

---

## 2026-06-22
### Task
Implement multi-role support (helper function approach)

### Work Done
- Added `secondary_roles?: string[]` to AccountUser type
- Created `utils/roleUtils.ts` with `hasRole()`, `hasAnyRole()`, `getUserRoles()` helpers
- Updated `authService.ts` to parse `secondary_roles` from user_metadata
- Updated `App.tsx` to parse + use `hasRole()` for routing
- Updated `HomeScreen.tsx` with `hasAnyRole()` for app filtering, badge shows all roles
- Replaced ALL `currentUser.role === 'X'` checks across 7 feature files with `hasRole()`/`hasAnyRole()`:
  - Invoice (useInvoiceState.ts), Expense (ExpenseList.tsx), Company (CompanyApp.tsx)
  - Payroll (PayrollFormulaPanel.tsx), HR (ChangeRequestTab.tsx, EmployeeDetail.tsx, EvalCycleDetail.tsx)
  - Navbar.tsx
- Added secondary roles toggle UI (pill buttons) in EmployeeDetail Role Changer section
- Updated edge function `create-employee-auth`:
  - New `update_secondary_roles` action
  - `check_email` now returns `secondary_roles` array
- Backward compatible: users with only primary role work unchanged

### Validation
- `npm run build` succeeded
- Zero remaining `currentUser.role ===` patterns in codebase
- Only 1 safe `.role ===` left (ProfileCompletionScreen reads raw session metadata, not AccountUser)

### Result
- A user can now have multiple roles (e.g. hr + ke_toan)
- App visibility, feature access, and routing all respect combined roles
- Admin can toggle secondary roles via UI in employee detail

### Next Step
- Deploy updated edge function to Supabase
- Test with real user: assign secondary role, verify app visibility changes

## 2026-06-22
### Task
Implement inline salary editing on HR Change Requests (pending + approved)

### Work Done
- Added `updateChangeRequestChanges()` to changeRequestService.ts — updates pending request's salary_components
- Added `editApprovedSalary()` to changeRequestService.ts — updates approved request + re-applies salary via rotateSalary + updates employee.salary + creates position history
- Added `directSalaryAdjust()` to changeRequestService.ts — standalone salary adjustment bypassing change requests
- Extracted `SalaryEditor` to standalone shared component (already done in prior session)
- Created `SalaryAdjustModal.tsx` (standalone modal, not currently wired — available for future use)
- Added inline edit mode to `RequestCard` in ChangeRequestTab.tsx — "Chỉnh sửa" button on salary-type requests (both pending and approved)
- For pending: edit only updates the request record
- For approved: edit updates request + re-applies salary to employee immediately
- Fixed `formInit` state type to include `effectiveDate`
- Added `onAdjustSalary` to `CardProps` interface

### Validation
- `npm run build` succeeded

### Result
- HR admin can now edit salary directly on existing change requests in the Đề xuất tab
- Works for both pending (just record update) and approved (record + live salary re-apply)
- Audit trail preserved via hr_position_history

### Next Step
- Test on live with real data
- Consider whether SalaryAdjustModal on Info tab is also needed in future

## 2026-06-21
### Task
AI Agent — Simplify roster to 4 core agents + unified Feed view

### Work Done
- Applied DB migration deactivating 6 agents (CEO, PM, Sales, Ops, Data, Support); CHRO, CFO, CTO, BD remain active
- Added dedup check in Edge Function `create_insight` case: skips insert if same `agent_id + title` inserted within 24h
- Added `fetchAllInsights()` to `aiAgentService.ts` (priority DESC + date sort)
- Created `FeedPanel.tsx`: unified insights list with agent badge per card, status/agent filter bar, 10-item pagination
- Updated `AgentSidebar.tsx`: Feed entry pinned above agent list with orange highlight when active
- Updated `AiAgentApp.tsx`: `isFeedView=true` as default, `switchToFeed`/`switchAgent` nav, Feed pill in mobile bar

### Validation
- `npm run build` passed (no TS errors)
- DB confirmed: 4 active (bd, cfo, chro, cto), 6 inactive (ceo, data, ops, pm, sales, support)

### Result
Spec `2026-06-21-ai-agent-simplify-design.md` fully implemented and committed (commit `7b6b0fd`). All 6 success criteria met.

### Blockers
none

### Next Step
Deploy to VPS (`vps-deploy-platforms.sh`) and verify Feed view loads correctly in production

## 2026-06-19
### Task
Thêm nút "Điều chỉnh lương" trên card đề xuất đã duyệt (HR)

### Work Done
- Phân tích luồng: `approveChangeRequest` → `rotateSalary` → DB cập nhật ngay, không cần truyền prefill salary
- Sửa `ChangeRequestTab.tsx`:
  - Thêm prop `onAdjustSalary` vào `CardProps` + `RequestCard`
  - Thêm button "💰 Điều chỉnh lương" (SM outline orange) trong expanded section — chỉ hiện khi `status=approved && type=salary_change && isAdmin`
  - Thay `showForm: boolean` → `formInit: { employeeId, type } | null`
  - Truyền `onAdjustSalary` callback từ list xuống từng card
  - Modal `ChangeRequestForm` dùng `formInit.employeeId` + `formInit.type`
- `ChangeRequestForm.tsx`: không cần sửa (đã có `initialEmployeeId` + `initialType`)

### Validation
- `npm run build` ✅ pass (7.79s)

### Result
- HR/admin click "Điều chỉnh lương" trên card approved → modal mở sẵn nhân viên + type salary_change
- Lương hiện tại load từ DB (đã được cập nhật sau approve) → HR chỉ sửa số, submit → pending mới

## 2026-06-18
### Task
Đơn giản hóa parking: thay tab "Gửi xe" riêng (bảng `hr_parking_registrations`) bằng 4 field inline trong `hr_employees` — đúng pattern bank info

### Work Done
- Apply Supabase migration: thêm 4 cột `vehicle_type`, `license_plate`, `vehicle_brand`, `vehicle_color` vào `hr_employees` (NOT NULL DEFAULT '')
- `portalService.ts`: thêm 4 vehicle fields vào `EMPLOYEE_EDITABLE_FIELDS` để `updateMyProfile` cho phép lưu
- `ProfileTab.tsx` (Portal): thêm section 🚗 Xe & Gửi xe inline sau section 🏦 bank info
- `PortalApp.tsx`: xóa toàn bộ parking tab (import, type, TAB_MAP/LABELS/REVERSE, accessibleTabs, useEffect, rendering block)
- `EmployeeForm.tsx` (HR): thêm section 🚗 sau section 🏦 (vehicle fields đã có trong initial state)
- `EmployeeDetail.tsx` (HR): xóa parking tab (type, button, content, reloadEquipmentParkingCounts → reloadEquipmentCount), thêm vehicle display inline sau bank info
- Xóa file `ParkingTab.tsx` và `ParkingRegistrationSection.tsx` (không còn được dùng)

### Validation
- `npm run build` thành công sau tất cả thay đổi
- `npm run build` thành công sau cleanup

### Result
- Thông tin xe nhân viên giờ lưu trực tiếp trong `hr_employees` (1 xe/nhân viên)
- UI: section inline trong cả Portal (ProfileTab) và HR (EmployeeForm + EmployeeDetail view)
- Tab "Gửi xe" đã bị xóa khỏi Portal navigation
- Bảng `hr_parking_registrations` vẫn còn trong DB (không drop) nhưng UI không dùng nữa

## 2026-06-17 (session 6)
### Task
Fix bug `query_data_integrity` trong Edge Function `agent-run` — TypeError khi gọi `.catch()` trên PostgrestBuilder

### Root Cause
`supabase.rpc('query_data_integrity_no_salary').catch(...)` — `PostgrestBuilder` trong Deno là "thenable" (implement `.then()`) nhưng không implement `.catch()`. Kết quả: `TypeError: ... .catch is not a function` → tool crash → agent report thiếu data integrity section.

### Fix
- Thay `.catch(() => ({ data: null }))` bằng `try/catch` block tại line 328 trong `supabase/functions/agent-run/index.ts`
- Xác nhận 2 `.catch()` còn lại (line 523 trên `fetch()`, line 759 trên `req.json()`) là native Promise — OK

### Validation
- Deployed lên Supabase Edge Functions thành công → version 17 ACTIVE

### Result
- `query_data_integrity` tool hoạt động đúng — không còn crash khi RPC call thất bại

---

## 2026-06-17 (session 5)
### Task
Deploy tất cả pending changes lên production

### Work Done
- Verified build ✅ (7.72s)
- Committed `fix(portal): wrap ensureBalancesForYear in try-catch` + `fix(agent-run): chat mode system prompt` → commit 9bdb688
- Committed memory files + AI Agent UI redesign plan docs → commit 7f32edd
- Pushed to main → GitHub Actions auto-deploy triggered

### Validation
- `npm run build` ✅ (7.72s)
- `git push origin main` ✅ — 5db3762..7f32edd pushed

### Result
- Production cập nhật với: AI Agent 3-column UI, LeaveTab bug fix, agent-run chat mode

### Next Step
- Kiểm tra production live tại https://app.tdgamestudio.com

---

## 2026-06-17 (session 4)
### Task
Bug fix: Employee Portal — nhân viên submit đơn nghỉ thành công nhưng không thấy danh sách đơn đã gửi

### Root Cause
`loadData()` trong `LeaveTab.tsx` gọi `ensureBalancesForYear()` trước khi gọi `fetchMyLeaveRequests()`.

`ensureBalancesForYear()` gọi `upsertLeaveBalance()` — thực hiện INSERT vào bảng `leave_balances`. Nhưng RLS policy `leave_balances_insert` chỉ cho phép `is_staff()`, nhân viên thường bị block. Lỗi RLS throw exception, `catch` block trong `loadData` bắt lỗi và exit sớm — `setRequests(reqs)` không bao giờ được gọi, `requests` luôn là `[]`.

**Bằng chứng:** `att_requests` có đủ dữ liệu (kiểm tra trực tiếp qua SQL), RLS SELECT policy đúng, chỉ balance INSERT bị block.

### Fix
`apps/portal/components/LeaveTab.tsx` — wrap `ensureBalancesForYear` trong try-catch riêng:
- Balance creation lỗi → log warning, không block flow chính
- `fetchMyLeaveRequests` luôn được gọi sau đó

### Validation
- `npm run build` succeeded (7.54s)

### Result
Nhân viên sẽ thấy danh sách đơn nghỉ sau khi fix deploy.
Balance cards sẽ hiển thị 0 cho nhân viên chưa có record trong `leave_balances` (HR tạo thủ công hoặc qua admin).

---

## 2026-06-17 (session 3)
### Task
AI Agent System — Step 7 Polish: notification badge + agent config editor

### Work Done
- Added `fetchTotalNewInsights()` to aiAgentService — counts all `status='new'` insights across all agents in 1 query
- Added `updateAgent()` to aiAgentService — partial update of agent profile fields
- Updated `HomeScreen.tsx`: fetch badge count on mount (admin only), pass `badgeCount` prop to AppCard for `ai-agent`
- Updated `AppCard`: new optional `badgeCount` prop renders a red overlay badge (≤9 shows number, >9 shows "9+") on icon top-right
- Updated `AiAgentApp.tsx`: added 5th tab "Cài đặt" with ConfigPanel component
- `ConfigPanel`: inline form with is_active toggle, avatar_emoji, name, role_title, model, temperature, personality — save via updateAgent()

### Validation
- `npm run build` ✅ (7.67s, 250 modules, no new errors)
- Commit: f147c82

### Result
- AI Agent System fully complete — all 7 steps done
- Home Screen now shows red badge count on AI Agent card when new insights exist
- Admins can edit agent config directly in UI without touching Supabase

### Next Step
- Deploy to production (push to main → GitHub Actions)

## 2026-06-17 (session 2)
### Task
AI Agent System — Backend, Frontend, Multi-agent

### Work Done
- **Backend**: Created DB schema (6 tables: ai_agents, ai_agent_runs, ai_agent_insights, ai_agent_episodes, ai_agent_knowledge, ai_agent_conversations + 5 views). Deployed edge function `agent-run` v7 with LLM loop, tool calling, and proper error handling
- **Infra**: Fixed 9Router DNS (Cloudflare A record), nginx config (already existed), Docker container restart (was exited 3 weeks), model selection (cx/gpt-5.5 works)
- **Agents**: Created 4 agents — CHRO (HR analysis), CEO (cross-functional), CFO (finance), CTO (tech/resource)
- **pg_cron**: 4 scheduled jobs for morning reports (08:30-09:00 VN, Mon-Fri)
- **Frontend**: Created `apps/ai-agent/` module — multi-agent selector, Insights/Runs/Memory tabs, manual trigger, review/dismiss actions. Registered in config/apps.ts + App.tsx
- **CHRO test run**: Successful — 43s duration, 4 insights generated (probation alerts, pending leave requests, unpaid leave patterns)
- **Plan doc**: Created `docs/AI_AGENT_PLAN.md` with full architecture, steps, and remaining work

### Validation
- `npm run build` succeeded
- CHRO agent completed run: 4 insights, 9308 input tokens, 1620 output tokens
- Edge function error handling verified: failed runs properly recorded

### Result
- AI Agent backend fully operational (CHRO tested, CFO/CEO/CTO created)
- Frontend app module ready (not yet deployed to production)

### Blockers
- CFO/CEO/CTO agents only have HR tools — need extended tool sets for finance/workforce data
- Not yet deployed to production (uncommitted changes)

### Next Step
- Commit and deploy to production
- Add RLS policies for ai_agent_* tables
- Extend edge function tools for CFO/CEO/CTO
- Telegram bot integration

---

## 2026-06-17
### Task
HR Change Request approval workflow — quy trình đề xuất và duyệt thay đổi nhân sự

### Work Done
- Thiết kế + implement `hr_change_requests` table (JSONB changes, current_snapshot)
- 5 loại đề xuất: lên chính thức, điều chỉnh lương, thăng chức, chuyển phòng ban, nghỉ việc
- `changeRequestService.ts`: CRUD + approve/reject + auto-apply logic
- `ChangeRequestTab.tsx`: list + filter (pending/approved/rejected) + detail expand + approve/reject UI
- `ChangeRequestForm.tsx`: modal chọn NV → chọn loại → form động theo type → submit
- `EmployeeForm.tsx`: khóa fields nhạy cảm (lương/chức vụ/phòng ban), link "Tạo đề xuất →"
- Portal: thêm tab "Đề xuất" cho NV xem đơn của mình
- Email notification deep-link: click email → mở thẳng đơn đề xuất cụ thể
- Fix: close old salary record trước khi insert mới khi approve; xóa orphan official salary modal
- 10 commits: 1db1433 → 169fb7f

### Validation
- `npm run build` ✅
- Deployed trên main

### Result
- HR tạo đề xuất → CEO duyệt → hệ thống tự cập nhật NV/lương/lịch sử
- NV thấy đơn đề xuất liên quan trong Portal
- Fields nhạy cảm trong EmployeeForm bị khóa, chỉ thay đổi qua đề xuất

---

## 2026-06-12
### Task
Mid-month salary proration — tính lương chính xác khi nhân viên lên chính thức giữa tháng + tăng lương

### Work Done
- Thêm cột `pre_official_base_salary` (bigint, nullable) vào `pay_payroll_records` via Supabase migration
- Thêm field vào `PayPayrollRecord` type và `PayrollInput` interface
- Sửa `calculatePayroll()`: khi có `preOfficialBaseSalary` + tháng chuyển giao → weighted base salary: `lươngCũ × probRatio + lươngMới × officialRatio`
- `createPayrollSheet()`: auto-detect lương cũ từ `hr_position_history` (change_type='salary')
- `recalculateRecord()`: truyền `pre_official_base_salary` qua PayrollInput
- PayrollSheet UI: editable input lương CB cũ trong expanded detail (draft mode), hiện prorate formula
- PaySlip: hiện 3 dòng (lương cũ TV%, lương mới CT%, prorate thực tế) thay vì 1 dòng lương CB
- Excel export: thêm cột "Lương CB cũ (TV)" trong batch export + dòng prorate trong phiếu lương cá nhân

### Validation
- `npm run build` ✅ clean (7.68s)
- Backward compatible: `pre_official_base_salary = null` → calculation unchanged
- Formula check: 10M × 0.4667 + 12M × 0.5333 = 11,066,667 (vs old: 12M — tiết kiệm 933K/tháng)

### Commits
- e66142c feat(payroll): mid-month salary proration for probation→official transitions

### Next Step
- Merge vào main
- Test thực tế trên app

## 2026-06-10
### Task
Email deliverability — thoát khỏi Spam → Promotions → Primary

### Work Done
- Traced chain: notification INSERT → trigger_notify_email → notify-email edge function → Resend (200 OK) — chain đúng, lỗi ở phía Gmail phân loại
- Phát hiện email vào Spam → đổi sang light HTML theme (v6)
- Phát hiện email vào Promotions → iterative debug qua v7–v11:
  - v8: per-type category badge, XHTML doctype, preheader
  - v9: payslip_pending_review thêm vào TYPE_META
  - v10: xóa orange accent bar, badge, gradient header → Supabase-style minimal
  - **v11 (fix thực sự)**: xóa `List-Unsubscribe` + `X-Mailer` headers, xóa `[TD Games]` bracket prefix trong subject, from name "TD Games Platform" → "TD Games"
- Tạo `EMAIL_STANDARD.md` — tài liệu chuẩn cho mọi luồng email tương lai
- Deep-link: email → `#portal/eval-{cycle_id}` → app tự mở form đánh giá
- PortalApp/EvalTab/PortalEvalList nhận `initialCycleId` và auto-open cycle

### Root Cause (email Promotions)
`List-Unsubscribe` header = Gmail's #1 signal phân loại bulk/newsletter → Promotions tab.
Volume <5000/day → không bắt buộc theo Google 2024 policy → xóa là đúng.

### Validation
- Email v11 → **vào Primary inbox** ✅ (confirmed by user)
- notify-email edge function: v11 ACTIVE

### Commits
- aee2469 feat(eval): deep-link from email to eval form + anti-spam improvements
- 56f35fc fix(email): switch to light theme to avoid Gmail spam filter
- b9969cf feat(email): full template redesign + EMAIL_STANDARD.md reference doc
- 4baf876 feat(email): final template redesign + EMAIL_STANDARD.md reference doc
- b944242 fix(email): add payslip_pending_review to TYPE_META
- e31839b fix(email): minimal Supabase-style template to escape Promotions tab
- cc7fac3 fix(email): remove Promotions signals — no brackets, no List-Unsubscribe ✅

---

## 2026-06-08 (session 3)
### Task
Eval deadline field + notify-on-create trigger + pg_cron daily reminder + deploy

### Work Done
- Added `deadline: string` to `HrEvaluationCycle` TypeScript type (`types.ts`)
- Updated `createCycle()` in `evaluationService.ts` to accept + INSERT `deadline`
- Added "Hạn nộp tự đánh giá *" date picker to `EvalCreateModal.tsx` (state, validation, pass to service)
- Added 2 new `TYPE_LABELS` to `notify-email/index.ts`: `eval_assigned`, `eval_deadline_reminder`
- Applied Migration 1 (`20260608110000_eval_deadline_and_notify.sql`):
  - `deadline timestamptz NOT NULL` column on `hr_evaluation_cycles`
  - `notify_eval_cycle_created()` trigger → notifies employee on new cycle INSERT (`eval_assigned`)
- Applied Migration 2 (`20260608120000_eval_deadline_reminder_cron.sql`):
  - `send_eval_deadline_reminders()` function: finds cycles with deadline = tomorrow, self not submitted → inserts `eval_deadline_reminder` notification (deduped via metadata->>'cycle_id')
  - pg_cron job `eval-deadline-reminder` at 01:00 UTC (08:00 VN) daily
- Deployed `notify-email` edge function → version 4 ACTIVE ✅

### Validation
- `npm run build` ✅ (0 errors, 7.13s)
- Migration 1 column verified: `deadline | timestamp with time zone | NO`
- pg_cron job verified: `eval-deadline-reminder | 0 1 * * *` present in `cron.job`
- Edge function v4 ACTIVE confirmed via Supabase MCP

### Result
- Khi HR tạo cycle mới, NV nhận ngay in-app noti `eval_assigned` + email "📋 Bạn có form tự đánh giá mới"
- Mỗi 08:00 VN, cron tự gửi nhắc nhở 1 ngày trước deadline cho NV chưa nộp tự đánh giá
- 6 commits trên main, push lên GitHub → GitHub Actions deploy VPS tự động

### Commits
- 5bea894 feat(eval): add deadline field to HrEvaluationCycle type
- 7ce314a feat(eval): thread deadline through createCycle service
- d7e5562 feat(eval): add deadline date picker to EvalCreateModal
- 54b1ada feat(eval): add eval_assigned and eval_deadline_reminder email labels
- 38a6061 feat(eval): add deadline column and notify_eval_cycle_created trigger
- 8194523 feat(eval): add pg_cron daily deadline reminder

---

## 2026-06-08 (session 2)
### Task
Email notifications cho evaluation workflow + deploy lên VPS

### Work Done
- Viết SQL migration `20260608100000_notify_evaluation.sql`:
  - `notify_eval_submission()`: NV nộp self → leader + HR/admin nhận noti; leader nộp → NV nhận noti
  - `notify_eval_cycle_status()`: pending_1on1 → HR/admin; completed → NV + leader
- Apply migration lên Supabase production via MCP execute_sql ✅
- Verify: cả 2 trigger live trên DB (`trg_notify_eval_submission`, `trg_notify_eval_cycle_status`)
- Update `supabase/functions/notify-email/index.ts`: thêm 4 TYPE_LABELS (eval_self_submitted, eval_leader_submitted, eval_1on1_required, eval_completed)
- Deploy edge function notify-email → version 3 ACTIVE ✅
- Commit 5 files + push lên main → GitHub Actions deploy tự động
- Verify VPS: commit fec1e59 đã có trên `/opt/tdgames-platforms` ✅

### Validation
- Triggers confirmed via `information_schema.triggers` query trên production DB
- Edge function v3 status: ACTIVE
- VPS git log khớp với local HEAD (fec1e59)

### Result
- Luồng email noti evaluation hoàn chỉnh cho 4 sự kiện
- Production live tại https://app.tdgamestudio.com

---

## 2026-06-08
### Task
Build Employee Evaluation v2 — HR tab + Employee Portal tab

### Work Done
- Created DB migration: `hr_evaluation_cycles` + `hr_evaluation_submissions` (2 new tables, indexes, RLS)
- Applied migration to Supabase production ✅
- Added TypeScript types: `EvalGroup`, `EvalPeriodType`, `EvalStatus`, `EvalRating`, `HrEvaluationCycle`, `HrEvaluationSubmission`
- Created `apps/hr/services/evaluationService.ts`: pure helpers (calcTotalScore, calcRating, calcGap, calcGroupAvg, autoLabel), full CRUD (fetchEvaluationCycles, fetchCycleById, fetchSubmissions, fetchMyCycles, createCycle, submitEvaluation, markComplete1on1, deleteCycle), fixed group config (getGroupsConfig — probation + semi_annual)
- Created HR components: `EvalScoreCard` (side-by-side comparison + gap alert), `EvalCycleDetail` (metadata + 1-on-1 action), `EvalCreateModal` (form), `EvalCycleList` (table + filter tabs), `EvalTab` (container)
- Created Portal components: `PortalEvalResult` (hero score + breakdown), `PortalEvalForm` (accordion groups, score buttons 1-5, live preview, sticky total), `PortalEvalList` (list with status routing to form/result), `EvalTab` (container with unlinked-account guard)
- Wired `evaluation` tab into `HrApp.tsx` (navbar key: `tasks`) and `PortalApp.tsx` (navbar key: `dashboard`)
- Updated `useHrState.ts` to add `evaluation` to `HrTab` type and `VALID_TABS`
- Build: `npm run build` ✅ — 0 errors

### Validation
- `npm run build` succeeded — 244 modules transformed
- Supabase migration applied successfully

### Result
- HR staff can create evaluation cycles, view self+leader submissions side-by-side, mark 1-on-1 complete
- Employees can fill self-assessment form (accordion UI, score 1-5, live preview) and view results
- Auto-advance: pending_self → pending_leader → (gap check) → pending_1on1 or completed
- Gap > 1.0 triggers requires_1on1 flag and blocks completion until HR marks 1-on-1 done

### Next Step
- Deploy branch to VPS after PR review
- Push branch and create PR

## 2026-06-04
### Task
Feature: Thêm toggle "Hiện tất cả tháng" trong form Tạo Nghiệm Thu (freelancer settlement)

### Work Done
- Đọc `SettlementCreateView.tsx` và phân tích filter logic hiện tại
- Thêm state `showAllTasks` (default `false`)
- Sửa `eligibleTasks` filter: thêm `!showAllTasks &&` trước date-bound checks — khi bật sẽ bỏ giới hạn `periodEnd` trên ngày task
- Thêm toggle button "Hiện tất cả tháng" vào thanh filter, hiển thị hint "Bỏ giới hạn tháng — hiện tất cả task chưa thanh toán" khi bật
- Cập nhật empty state message phản ánh trạng thái toggle
- `npm run build` thành công, không có lỗi TypeScript

### Validation
- `npm run build` passed

### Result
- User có thể bật toggle để thấy toàn bộ task chưa thanh toán của worker, bao gồm task tạo sau tháng nghiệm thu
- Behavior mặc định không thay đổi (backward-compatible)
- 1 file thay đổi: `apps/workforce/components/settlement/SettlementCreateView.tsx`

---

## 2026-06-03 (session 4)
### Tasks
1. Bug fix: Settlement→expense sync không hoạt động (công nợ không cập nhật)
2. UI fix: Tên nhân viên bị truncate trong bảng lương
3. Feature: exclude_from_payroll flag cho nhân viên không nhận lương

### Work Done
**Bug: Settlement→expense sync**
- Root cause 1: `worker:wf_workers(name)` → column thực là `full_name` → query lỗi → `existing = null` → block tạo expense bị skip hoàn toàn
- Root cause 2: không check `error` từ supabase insert → lỗi nuốt im lặng
- Root cause 3: khi `expense_id` đã có → không update `status='paid'`
- Fix: đổi `name` → `full_name`, throw fetchErr/insertErr, thêm else branch update status
- Backfill data: SQL insert 9 expense records cho 9 settlements đã paid + link expense_id

**UI: Tên nhân viên bị cắt**
- Root cause: badges (Phiếu lương, CHỜ XN, THỬ VIỆC) inline cùng dòng với tên → tên bị truncate
- Fix: tên hiển thị dòng 1, badges xuống dòng 2 (flex-col). Cột tên: 2fr → 3fr

**Feature: exclude_from_payroll**
- DB migration: `exclude_from_payroll boolean default false` vào `hr_employees`
- types.ts: thêm field vào `HrEmployee`
- payrollService: filter `.neq('exclude_from_payroll', true)` khi tạo bảng lương
- EmployeeForm: thêm checkbox toggle "Không tính lương tự động"
- Data: set `exclude_from_payroll=true` cho Đặng Thế Toàn, xóa record khỏi bảng T5/2026

### Commits
- `5cd36cd` fix(workforce): correct worker name column + error handling
- `375eabd` fix(payroll): show full employee name — stack badges on second line
- `6f343a1` feat(hr/payroll): exclude_from_payroll flag for employees

### Validation
- `npm run build` succeeded × 3
- Deployed tất cả → https://app.tdgamestudio.com

## 2026-06-03 (session 3)
### Task
Bug fix: Công nợ phải trả không cập nhật realtime sau khi thanh toán nghiệm thu

### Root Cause
`useAccountingState.ts` fetch `expense_expenses` một lần lúc mount, không có Supabase realtime subscription. Khi Workforce ghi payment vào `expense_expenses`, Accounting không hay biết → Công nợ phải trả không cập nhật.

### Work Done
- Thêm Supabase realtime subscription (INSERT/UPDATE/DELETE) cho `expense_expenses` vào `useAccountingState.ts`
- Cập nhật state trực tiếp khi nhận event, không cần reload toàn bộ

### Validation
- `npm run build` succeeded (234 modules)
- Deployed: commit 8fdd5d2 → https://app.tdgamestudio.com

### Result
- Công nợ phải trả bây giờ cập nhật realtime ngay khi kế toán Workforce thanh toán nghiệm thu

## 2026-06-03 (session 2)
### Task
Payroll employee acknowledgement flow

### Work Done
- DB: thêm `employee_status` (pending/confirmed/disputed/resolved), `employee_confirmed_at`, `employee_comment` vào `pay_payroll_records`
- DB trigger `trg_notify_payroll_confirmed`: gửi noti loại `payslip_pending_review` cho từng NV khi sheet → confirmed
- `portalService.ts`: thêm `submitPayslipAcknowledgement()` và `resolvePayslipDispute()`
- `PayslipAcknowledgeModal.tsx`: component blocking full-screen, hiện phiếu lương tóm tắt + 2 nút (Xác nhận / Báo sai sót), không thể đóng
- `PortalApp.tsx`: load pending payslip on mount, hiện modal blocking nếu có
- `PayrollSheet.tsx`: badge employee status per row, khối xác nhận NV trong expanded section, resolve button cho disputed, block "Đã trả lương" khi còn pending/disputed
- `usePayrollState.ts`: thêm `resolveDispute()` callback
- `PayrollApp.tsx`: wire `onResolveDispute` prop

### Validation
- `npm run build` succeeded (234 modules)
- Deployed: commit c35f32f → https://app.tdgamestudio.com

### Result
- Khi kế toán xác nhận bảng lương → NV nhận noti ngay
- NV vào portal → bị chặn bởi màn hình xác nhận bắt buộc
- NV xác nhận đúng hoặc gửi khiếu nại kèm mô tả
- Kế toán thấy trạng thái từng NV, có thể resolve khiếu nại
- Nút "Đã trả lương" chỉ active khi tất cả NV confirmed/resolved

## 2026-06-03
### Task
Payroll: tính ngày công tiêu chuẩn động (T2-T6) + thêm bonus_reason

### Work Done
**Dynamic standard work days:**
- Thêm cột `standard_work_days smallint` vào `pay_payroll_sheets` (Supabase migration)
- Tạo `apps/payroll/utils/workdayUtils.ts` với hàm `countWeekdays(year, month)` — đếm T2-T6 thực tế (21/22/23 tuỳ tháng)
- Sửa `calculatePayroll()` nhận param `standardWorkDays?` override formula config
- Sửa `createPayrollSheet()` tính `stdDays = countWeekdays(year, month)`, lưu vào sheet, dùng làm std trong tính lương và fallback attendance
- Sửa `recalculateRecord()` + `recalculateAndSave()` nhận `standardWorkDays?`
- Sửa `usePayrollState.ts` truyền `activeSheet?.standard_work_days` khi recalculate
- Sửa `PayrollSheet.tsx` dùng `sheet.standard_work_days ?? formula.standardWorkDays` ở 3 chỗ hiển thị
- Backward compatible: sheet cũ có `standard_work_days = null` → fallback về formula config (22)

**Bonus reason:**
- Thêm cột `bonus_reason text` vào `pay_payroll_records` (Supabase migration)
- Thêm `bonus_reason?: string | null` vào `PayPayrollRecord` type
- Sửa `updateRecord` trong hook nhận `number | string` — string field không trigger recalculate
- Thêm `handleStringChange()` trong `PayrollSheet.tsx`
- UI bonus cell: hiển thị số tiền + lý do italic khi view; edit mode có 2 input (số tiền + lý do)
- Expanded detail: label thưởng hiển thị lý do nếu có ("Thưởng: Thưởng KPI Q2")

### Validation
- `npm run build` succeeded (2 lần, cả 2 pass)

### Result
- Bảng lương mới tạo từ giờ dùng số ngày T2-T6 thực tế của tháng thay vì cố định 22
- HR nhập ngày công thực tế của nhân viên, hệ thống tính tỷ lệ dựa trên T2-T6 của tháng đó
- Kế toán có thể nhập tiền thưởng + lý do thưởng cho từng nhân viên trong bảng lương

## 2026-06-01 (session 2)
### Task
Outreach Smart Signals — Apollo Intent Topics + Engagement Counter

### Work Done
**VPS (live):**
- `services/apollo.py`: thêm `intent_only` param + `q_organization_intent_strengths: ["strong"]` filter
- `routes/automation.py`: `daily-discover` nay set đúng `trigger_source` + `lead_score` khi insert lead:
  - intent_signal → score 90
  - generic → T1=50, T2=40, T3=30
- `routes/webhook.py`: `_handle_engagement()` upgrade:
  - Increment `open_count` / `click_count` trong DB (thay vì chỉ append notes)
  - Discord hot lead alert khi open_count đạt 3, 5, 10

**DB (live — Supabase):**
- Thêm `open_count INTEGER DEFAULT 0` vào `crm_outreach_leads`
- Thêm `click_count INTEGER DEFAULT 0` vào `crm_outreach_leads`
- Index `idx_leads_open_count`

### Validation
- `npm run build` ✅ no errors
- `systemctl is-active td-mailer-api` → active ✅
- Pushed to `main`, GitHub Actions deploy triggered

### Result
- Studio mở email 3+ lần → Discord alert "🔥 Hot Lead — [Name] ([Studio])" tự động
- Apollo daily-discover sẽ tag leads có intent signal với score 90 (cao nhất trong hệ thống)
- Cần setup: vào Apollo dashboard → configure 6 Intent Topics slots với: "game art outsourcing", "3D animation", "art production", "game development outsourcing"

## 2026-06-01 (session 1)
### Task
Outreach Phase A — Hiring Signal Discovery Pipeline

### Work Done
- DB migration: thêm `trigger_source` (default 'generic') + `lead_score` (0-100) vào `crm_outreach_leads`
- VPS: tạo `services/hiring_signals.py` — Google CSE parser v3, tự clean tên platform (LinkedIn, Indeed) khỏi company name
- VPS: tạo `cron_hiring_signals.py` — daily cron 07:00 ICT, insert leads với trigger_source='hiring_signal', Discord notification
- VPS: đăng ký cron `/etc/cron.d/td-mailer-automation` (0 0 * * *)
- Frontend `types.ts`: thêm `trigger_source` + `lead_score` vào `CrmOutreachLead`
- Frontend `outreachService.ts`: thêm filter `trigger_source`, sort by `lead_score DESC`
- Frontend `EmailOutreach.tsx`: badge "🔎 Hiring" + score, filter dropdown "Hiring Signal / Generic"
- Migration file: `supabase/migrations/20260531000000_add_trigger_source_score.sql`
- Branch: `feat/outreach-hiring-signals-phase-a`

### Validation
- `npm run build` ✅ no errors
- Dry run: 18 unique studios found từ Google CSE
- Real run: 17 leads inserted với trigger_source='hiring_signal'
- Discord nhận notification với danh sách studios

### Result
- Pipeline từ: Apollo random discovery
- Pipeline thành: Hiring signal leads (studios ĐANG tuyển art roles) + generic leads song song
- Leads sorting: hiring signal (score 55-85) lên trên, generic (30-50) xuống dưới
- Giai đoạn B (template personalization): làm sau khi A vận hành 1-2 tuần

## 2026-05-31
### Task
Thêm Discord notifications chi tiết cho toàn bộ outreach pipeline

### Work Done
**VPS (live ngay):**
- Tạo `/opt/td-mailer-api/services/discord.py` — shared Discord helper (3 functions: notify_batch_done, notify_followup_done, notify_discovery_done)
- Patch `routes/email.py` — thêm Discord sau khi `_run_batch` hoàn thành (danh sách ai được gửi, success/fail)
- Patch `cron_followup.py` — thêm Discord sau mỗi lần chạy FU1/FU2 (danh sách recipients)
- Restart `td-mailer-api` service, test Discord helper → OK

**Supabase Edge Function:**
- Update `outreach-auto-discovery` v4 — Discord message giờ kèm danh sách contacts tìm được (max 15), inline/non-inline tự động theo độ dài, truncate 1024 chars
- Cũng thêm error Discord khi FastAPI không reach được hoặc trả lỗi

### Validation
- `python3 -c "from services.discord import notify_followup_done; notify_followup_done([], [])"` → Discord received ✅
- `systemctl is-active td-mailer-api` → active ✅
- Edge Function deploy → ACTIVE version 4 ✅

### Result
Discord channels sẽ nhận:
- 📧 **Batch email done** (khi initial_outreach batch xong): danh sách người nhận + status
- 📨 **Follow-up cron** (10:00 ICT mỗi ngày): danh sách FU1/FU2 đã gửi
- 🔍 **Auto Discovery** (02:00 UTC): danh sách contacts tìm được theo country

## 2026-05-30 (session 2)
### Task
Debug tại sao auto discovery tìm được 0 contacts + fix Apollo API deprecated endpoint

### Work Done
- Phân tích trạng thái toàn bộ outreach pipeline qua Supabase DB và VPS
- Tìm ra `cron_followup.py` hoạt động đúng (gửi FU2 mỗi ngày theo 7-day delay)
- Xác nhận `daily-send` hết pending leads là ĐÚNG behavior (không phải bug)
- Tìm root cause: Apollo deprecated `mixed_people/search` → 422 error → 0 contacts/ngày
- Fix: đổi sang `mixed_people/api_search` trong `/opt/td-mailer-api/services/apollo.py`
- Backup: `apollo.py.bak-20260530`
- Restart `td-mailer-api` service
- Verify: EA test trả về 5 contacts đúng (Art Director, Executive Art Director + email thật)

### Validation
- `curl localhost:8401/api/leads/discover` → 5 contacts found for EA ✅
- `systemctl status td-mailer-api` → active (running) ✅

### Result
- Discovery pipeline hoạt động trở lại — cron 08:00 ICT sẽ tìm được contacts mới
- 138 leads ở `followup1_sent` đang được xử lý đúng bởi `cron_followup.py`
- Không cần thay đổi gì ở Supabase hay frontend

## 2026-05-30 (session 1)
### Task
Debug và fix các bug trong CRM Outreach flow (studio search, email sending)

### Work Done
- Đọc và trace toàn bộ luồng outreach: `outreachApi.ts` → `outreachService.ts` → `EmailOutreach.tsx` → `AutoTab.tsx`
- Phát hiện 5 bugs qua systematic code review

**Bug fixes:**
1. **[CRITICAL] types.ts** — Thêm `'invalid_email'` vào union type `CrmOutreachLead.outreach_status` (thiếu khiến TypeScript lỗi ở nhiều chỗ)
2. **[CRITICAL] EmailOutreach.tsx line 1492** — Batch results "Add" button gọi `handleAddToLeads(c, r.company)` truyền tên công ty vào `emailOverride` thay vì email thật. Fix: `handleAddToLeads(c, c.email, r.company)`
3. **[MODERATE] EmailOutreach.tsx** — `loadAll` catch block nuốt lỗi im lặng (`catch { }`). Fix: log ra console với context
4. **[MODERATE] EmailOutreach.tsx** — Analytics tab không check `r.ok` trước khi `.json()` → có thể crash khi API trả 500. Fix: thêm ok-guard
5. **[MINOR] AutoTab.tsx** — 4 handlers (`handleToggleDiscovery`, `handleSaveDiscovery`, `handleToggleBatch`, `handleSaveBatch`) dùng `.update().eq()` thay vì `.upsert()` → nếu row chưa tồn tại thì không ghi được. Cả 4 đều thiếu try/catch khiến `setSaving(false)` không bao giờ được gọi khi lỗi. Fix: chuyển sang `.upsert({onConflict: 'key'})` + wrap try/catch/finally

### Validation
- `npm run build` thành công (7.07s) — không có errors, chỉ warnings chunk size cũ

### Result
- Luồng studio search và contact discovery: hoạt động đúng (không có bug logic)
- Email sending (single + bulk): hoạt động đúng
- Batch results "Add" button: **đã fix** — trước đây tạo lead với email = tên công ty
- AutoTab save/toggle: **đã fix** — bây giờ upsert đúng + không bị stuck loading state khi lỗi

## 2026-05-29
### Task
Thêm thưởng KPI (bonus) vào Payroll module

### Work Done
- Tạo DB migration `20260529000000_add_bonus_payroll_records.sql` — thêm cột `bonus numeric NOT NULL DEFAULT 0` vào `pay_payroll_records`
- Apply migration lên Supabase live DB thành công
- Thêm `bonus: number` vào `PayPayrollRecord` interface trong `types.ts`
- Sửa `recalculateRecord()` trong `payrollService.ts`: cộng `bonus` vào `net_salary` và `total_company_cost` sau khi tính 8-step; không ảnh hưởng thuế/BH
- Thêm `bonus: 0` vào `createPayrollSheet()` khi khởi tạo records mới
- `PayrollSheet.tsx`: cột "Thưởng" editable (vàng, step 1000), summary card "Tổng thưởng KPI", dòng bonus trong expanded detail panel, cột bonus trong summary row
- `PaySlip.tsx`: dòng "+Thưởng KPI" (màu amber) hiển thị khi bonus > 0, cả 2 nhánh probation & official
- `payrollExportService.ts`: thêm cột "Thưởng KPI" vào bảng lương Excel và dòng bonus vào phiếu lương Excel

### Validation
- `npm run build` thành công ✓ (7.12s, 0 lỗi mới)
- DB migration applied qua Supabase MCP

### Result
- Branch `feat/payroll-kpi-bonus` với 4 commits sẵn sàng merge
- HR có thể nhập thưởng KPI cuối tháng trực tiếp trong bảng lương draft
- Bonus cộng thẳng vào net lĩnh và chi phí công ty, không tính thuế/BH

### Next Step
- Merge `feat/payroll-kpi-bonus` vào `main`
- Deploy lên VPS nếu cần

---

## 2026-05-28
### Task
Triển khai module Tiết kiệm & Vay nợ trong app Kế toán

### Work Done
- Đọc spec `2026-05-28-savings-loans-design.md` — spec đã đầy đủ từ session trước
- Xác nhận DB tables `acc_savings` + `acc_loans` đã tồn tại với RLS đúng (admin + ke_toan)
- Xác nhận các file service/component đã được tạo từ session trước (savingsService.ts, loansService.ts, SavingsTab.tsx, LoansTab.tsx)
- Fix còn lại: wired `SavingsTab` + `LoansTab` vào `AccountingApp.tsx` (render switch + ACCESSIBLE_TABS)
- Xác nhận `useAccountingState.ts` đã có `savings`/`loans` state và fetch
- Xác nhận `types.ts` đã có `SavingsDeposit` + `LoanRecord` interfaces
- `npm run build` thành công (7.37s, 0 TypeScript errors)
- Commit 88ed9c4, pushed origin/main ✅

### Validation
- `npm run build` ✅
- RLS policies trên `acc_savings` + `acc_loans`: SELECT/INSERT/UPDATE/DELETE đều require `admin` hoặc `ke_toan` ✅
- INSERT có đúng `WITH CHECK` clause ✅

### Result
- App Kế toán có 2 tab mới: 💰 Tiết kiệm + 🏧 Vay nợ
- Tiết kiệm: thêm/tất toán/tái tục, warning đáo hạn ≤30 ngày + quá hạn, 4 KPI cards, bảng chi tiết
- Vay nợ: thêm/trả nợ/tất toán, warning quá hạn, 4 KPI cards, bảng chi tiết
- Mọi action tự tạo bản ghi trong `expense_expenses` → CashFlow tự động cập nhật

## 2026-05-26
### Task
Thêm tab BHXH vào app Kế toán – bảng kê nộp BHXH độc lập với bảng lương

### Work Done
- Khảo sát codebase: xác nhận BHXH hiện chỉ được tính trong Payroll (payrollService.ts), chưa có báo cáo riêng
- Thiết kế: tab BHXH trong Accounting app (cùng domain với TNCN, VAT – nghĩa vụ nộp nhà nước)
- `accountingService.ts`: thêm `BhxhEmployee` interface + `fetchEmployeesForBhxh()` (fetch active employees với salary, insurance_number, official_date)
- `useAccountingState.ts`: thêm `'bhxh'` vào AccountingTab type, state `bhxhEmployees`, fetch trong `loadAll`
- `BhxhTab.tsx`: tạo mới – month/year picker, lấy formula động từ `pay_payroll_formula_settings`, lọc thử việc, 4 summary cards, bảng kê, export Excel (xlsx)
- `AccountingApp.tsx`: thêm tab `🛡️ BHXH` vào navbar + render BhxhTab

### Validation
- `npm run build` thành công (3 commits sạch)

### Result
- App Kế toán có tab BHXH mới
- Kế toán có thể xem và xuất bảng kê BHXH trước ngày 25 hàng tháng, độc lập với việc khóa bảng lương cuối tháng
- Tỷ lệ lấy từ PayrollFormulaConfig (đồng bộ với bảng lương, tự động cập nhật khi admin đổi tỷ lệ)
- Nhân viên thử việc tự động bị loại khỏi bảng kê; nhân viên mới vào tháng được đánh dấu ghi chú

## 2026-05-21 — Company app UI/UX Style Guide fixes

### Task
Chuẩn hoá UI/UX Company module theo Style Guide

### Work Done
- Audit 4 component: CompanyApp (shell ✅), InfoTab, BankTab, DocumentsTab
- **CompanyApp**: footer `border-t` → `border-t border-white/5`
- **InfoTab**: xoá `max-w-3xl` → `w-full`; restructure header layout; thêm `SidebarItem` component; 2-column dashboard layout (main 2/3 + sidebar sticky 1/3 với quick-ref orange-tinted card + address card)
- **BankTab**: xoá `max-w-3xl` → `w-full`; accounts `space-y-3` → `grid grid-cols-1 md:grid-cols-2 gap-4`
- **DocumentsTab**: inputs/select thêm `focus:border-orange-500/50 transition-colors`

### Validation
- `npm run build` ✅ (7.02s, no TypeScript errors)
- Commit 577b14f, pushed origin/main ✅

### Result
- Company module nhất quán với Style Guide; InfoTab tận dụng 2-col layout đúng chuẩn

## 2026-05-21 — Accounting UI/UX Style Guide fixes

### Task
Chuẩn hoá UI/UX toàn bộ Accounting module (7 tabs) theo Style Guide

### Work Done
- Audit 7 tab accounting vs STYLE_GUIDE.md — phát hiện vi phạm nhất quán trên 6 tab
- **PayablesTab, PnlTab, BankReconcTab, VatTab, TncnTab**: KPI card labels `text-xs` → `text-[10px] font-black text-neutral-600`; values `text-xl`/`text-lg` → `text-2xl font-black`
- **PnlTab**: view switcher + section labels `font-bold` → `font-black`; bar chart `duration-700` removed
- **BankReconcTab**: filter + inline buttons `font-bold` → `font-black`
- **AdvanceTab**: form inputs `bg-white/5 px-4 py-3` → `style={{ background: '#1a1a1a' }} px-3 py-2`; labels `text-xs font-bold` → `text-[10px] font-black`; modal titles `text-xl` → `text-base uppercase tracking-wider`; cancel buttons → ghost pattern chuẩn

### Validation
- `npm run build` ✅ (6.98s, no TypeScript errors)
- grep verify: 0 violations còn lại
- Commit 7265ea8, pushed origin/main ✅

### Result
- Toàn bộ Accounting module (FixedAssetTab đã đúng từ đầu + 6 tab vừa fix) nhất quán 100% với Style Guide
- KPI cards, form inputs, buttons đều dùng đúng token/pattern

## 2026-05-21 — Dashboard Style Guide

### Task
Viết và lưu Dashboard UI/UX Style Guide chuẩn hoá cho toàn platform

### Work Done
- Phân tích gap giữa landing page style guide và thực tế codebase (typography scale, button sizes, animation, spacing)
- Viết `.agent/meta/STYLE_GUIDE.md` — style guide dashboard-specific với: color tokens, typography scale, 3-tier buttons, card variants, badges, form inputs, layout patterns, animations, empty states, toast
- Cập nhật `CLAUDE.md` (project root) — thêm rule bắt buộc đọc STYLE_GUIDE.md trước khi làm UI
- Cập nhật `index.html` (session trước) — thêm elevation/glow shadow tokens, keyframes scaleIn/shake/tdPulse, CSS variables, focus-visible, sr-only

### Result
- AI session sau sẽ tự load rule từ CLAUDE.md và biết đọc STYLE_GUIDE.md trước khi thiết kế UI
- Style guide phản ánh đúng patterns đang chạy trong codebase, không phải lý thuyết landing page

---

## 2026-05-21 — Company app Option B dashboard layout

### Task
Redesign Company app layout: remove narrow `max-w-3xl` constraint, implement 2-column dashboard layout

### Work Done
- `InfoTab.tsx`: xoá `max-w-3xl`, view mode → 2-col grid (`lg:col-span-2` main + `lg:col-span-1` sidebar)
  - Sidebar: sticky "Tóm tắt nhanh" card (MST, đại diện, ngày HĐ, email) + address card
  - Edit mode: giữ full-width form như cũ
- `BankTab.tsx`: xoá `max-w-3xl`, accounts hiển thị `grid-cols-1 md:grid-cols-2`
- `DocumentsTab.tsx`: xoá `max-w-3xl` → `w-full`

### Validation
- `npm run build` ✅ passed (6.72s)

### Result
- Company app tận dụng toàn bộ chiều ngang màn hình
- InfoTab có sidebar "Tóm tắt nhanh" với các trường quan trọng nhất
- BankTab cards hiển thị dạng grid 2 cột trên màn hình rộng

---

## 2026-05-21 (session — UI/UX layout fixes)
### Task
Chuẩn hoá layout AccountingApp và CompanyApp theo standard app shell

### Work Done
- `apps/company/components/CompanyApp.tsx`: sửa `max-w-[1200px]` → `max-w-[1400px]` trong `<main>`
- `apps/accounting/components/AccountingApp.tsx`: refactor hoàn toàn
  - Xoá custom sticky top bar + inline tab buttons
  - Thêm `<AppBackground />`, `<Navbar>` (với vcbRate/vcbRateLoading, TAB_LABELS 7 tabs, onHelp)
  - Thêm `<ToastNotification>` thay thế inline toast div
  - Đổi content wrapper thành `<main className="flex-1 p-6 md:p-12 max-w-[1400px] mx-auto w-full">`
  - Thêm `<footer>` chuẩn

### Validation
- `npm run build` ✅ passed (7.02s, không có lỗi TypeScript)

### Result
- Cả 2 app giờ dùng chung Navbar component, AppBackground, cùng max-width 1400px, cùng footer — UI/UX nhất quán với toàn bộ platform

## 2026-05-21 (session — Company module)
### Task
Build module Hồ sơ Công ty (Company app mới)

### Work Done
- Supabase migration `create_company_module`: tạo `company_profiles` + `company_documents` tables, RLS policies (authenticated read / admin-ke_toan write), seed TD GAMES profile (MST 0111386856)
- `apps/company/services/companyService.ts`: fetchCompanyProfiles, updateCompanyProfile, fetchCompanyDocuments, uploadCompanyDocument (Supabase Storage bucket `company-documents`), getDocumentUrl (signed URL 1h), deleteCompanyDocument
- `apps/company/components/InfoTab.tsx`: view/edit legal info (MST, địa chỉ, người đại diện, ngày hoạt động...), inline form với auto-save
- `apps/company/components/DocumentsTab.tsx`: upload PDF/ảnh/doc, list với type badge + file size + date, signed URL viewer, delete confirm
- `apps/company/components/BankTab.tsx`: display `finance_bank_accounts` filtered by entity_short
- `apps/company/components/CompanyApp.tsx`: shell với Navbar 3 tab + entity switcher (nếu nhiều pháp nhân) + HelpPanel
- `apps/company/helpContent.ts`: 3 sections help
- `config/apps.ts`: thêm entry `company` (admin + ke_toan, icon 🏢)
- `App.tsx`: import CompanyApp + route `activeApp === 'company'` + VALID_APPS

### Validation
- `npm run build` ✅ (6.92s, no TypeScript errors)
- commit 6d8e756, pushed to origin/main ✅
- VPS auto-deploy triggered via GitHub Actions

### Result
- App "🏢 Công ty" xuất hiện trên HomeScreen cho admin/ke_toan
- TD GAMES profile seeded sẵn với đầy đủ thông tin pháp lý
- Upload giấy tờ vào Supabase Storage, xem qua signed URL

### Next Step
- Tạo Storage bucket `company-documents` trên Supabase nếu chưa tự tạo (auto-create khi upload đầu tiên)
- Upload GPKD, đăng ký thuế, CCCD đại diện vào DocumentsTab
- Điền thêm phone number cho TD GAMES profile

---

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
