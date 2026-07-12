# Design — Tách hoàn toàn 2 công ty: TD Games / TD Consulting

**Ngày:** 2026-07-12
**Trạng thái:** Chờ sếp duyệt
**Thay thế:** mở rộng spec `2026-07-10-multi-book-workspace-design.md` (chỉ mới tách sổ finance)

---

## Vấn đề

Spec 2026-07-10 chỉ tách **sổ sách** (invoice/expense/bank). Ý đồ thật của sếp:
**2 công ty độc lập hoàn toàn** — chuyển workspace là toàn bộ dữ liệu mọi app
(nhân sự, chấm công, lương, kế toán, CRM, workforce...) đổi theo công ty đang chọn.
Thêm nhân sự/chi phí bên TD Consulting không liên quan gì TD Games.

## Quyết định đã chốt (qua chat)

1. **Tách tất cả module có dữ liệu**: HR, Attendance, Payroll, Accounting, Expense, Invoice, CRM, Workforce, Dashboard.
2. **"Hợp nhất" chỉ còn ở CEO Dashboard** (toggle riêng trong dashboard). Mọi app khác tách cứng theo workspace.
3. **Nhân sự**: mỗi công ty danh sách nhân viên riêng. 1 người làm cả 2 công ty = 2 hồ sơ `hr_employees` (2 hợp đồng, 2 payroll). Đăng nhập vẫn 1 hệ thống auth chung.
4. Phòng ban, dữ liệu TD Consulting bắt đầu **trống** — record cũ backfill hết về TD Games.

## Cách tiếp cận (đã chọn: A)

- **A (chọn)** — cột `entity` trên **bảng gốc** mỗi module, bảng con kế thừa qua FK. Reuse đúng convention đã có: `entity text not null default 'TD GAMES' check (entity in ('TD GAMES','TD CONSULTING'))`.
- B (loại) — bảng `companies` + company_id + RLS: thừa cho 2 công ty cố định, user toàn nội bộ.
- C (loại) — 2 Supabase project: gấp đôi vận hành, không xem hợp nhất được.

## 1. Data layer — 1 migration

Thêm cột `entity` (convention trên) vào các **bảng gốc**:

| Module | Bảng thêm cột `entity` | Bảng con kế thừa qua FK (không sửa) |
|---|---|---|
| HR | `hr_employees`, `hr_departments`, `hr_evaluation_cycles` | contracts, employee_salary, position_history, project_history, documents, dependents, reminders, change_requests, evaluation_submissions, equipment_handovers, parking_registrations, onboarding_acknowledgments |
| Attendance | `att_monthly_sheets`, `att_shifts` | att_monthly_records (FK sheet), att_requests (FK employee) |
| Payroll | `pay_payroll_sheets` | pay_payroll_records |
| CRM | `crm_clients`, `crm_studios`, `crm_outreach_leads`, `crm_email_templates` | contacts, projects, deals, quotations, documents, activities, payment_schedules, project_files, email_log (FK lead) |
| Workforce | `workforce_workers` | workforce_tasks, workforce_settlements |
| Accounting | `acc_savings`, `acc_loans`, `acc_fixed_assets`, `acc_advances`, `acc_bhxh_payments` | acc_bank_statements (FK bank account đã có entity), finance_bank_balance_snapshots |
| Expense | `expense_recurring` (+ `expense_expenses`, `invoice_invoices`, `finance_bank_accounts` **đã có** từ spec trước) | invoice_line_items |

- Backfill: default `'TD GAMES'` → mọi record cũ tự về TD Games.
- Implementation phải chạy `list_tables` xác nhận tên bảng/FK thật trước khi viết migration.

**Giữ CHUNG (không tách):** `expense_categories`, `pay_payroll_formula_settings`, `hr_salary_components` (config theo luật/chung), AI Agent (`ai_*`), auth/roles, system-monitor, handbook nội dung.

## 2. Workspace switcher

- `WorkspaceContext`: bỏ `'all'` → type `'TD GAMES' | 'TD CONSULTING'`. Migrate giá trị localStorage cũ `'all'` → `'TD GAMES'`.
- Navbar switcher hiện cho `admin`, `ke_toan`, `hr` (HR/Payroll giờ cũng tách).
- Member/freelancer không thấy switcher — Portal/Freelancer Portal tự theo hồ sơ của họ (employee/worker record đã có entity).

## 3. Hành vi trong app

- **List/query**: mọi service của module tách filter theo `useWorkspace()` — bảng gốc filter trực tiếp `eq('entity', ws)`, bảng con filter qua join/`in(employee_id, ...)` theo bảng gốc.
- **Tạo mới**: form tự gắn `entity = workspace hiện tại`, KHÔNG có field chọn tay (bỏ field entity chọn tay đã thêm ở Expense/Invoice form — thay bằng auto-tag; giữ hiển thị badge).
- **Hồ sơ pháp nhân**: Invoice/Contract generator lấy thông tin công ty (tên, MST, địa chỉ, bank) theo workspace — TD CONSULTING COMPANY LIMITED, MST 0109898663 (đã có constant).
- **E-invoice**: giữ nguyên — chỉ TD Games.
- **Dashboard (CEO)**: toggle nội bộ TD Games / TD Consulting / Hợp nhất; edge function `platform-data` nhận param `entity` (bỏ param = hợp nhất). Mặc định theo workspace hiện tại.
- **Chuyển workspace** → reload data các app đang mở (các app đọc context, re-fetch khi workspace đổi).

## 4. Bảo mật

Như spec trước: phân quyền theo role đã chặn app-level; switcher chỉ là UI filter,
không cần RLS mới. Chấp nhận: admin/ke_toan/hr đều thấy được cả 2 công ty khi tự đổi workspace.

## 5. Phạm vi sửa code (ước lượng)

- 1 migration (~15 bảng thêm cột).
- `WorkspaceContext` + `Navbar`.
- Services: `hrService`, `evaluationService`, `changeRequestService`, `payrollService`, `crmService`, `studioService`, `outreachService`, `crmPaymentScheduleService`, `accountingService`, `savingsService`, `loansService`, `taxPortalService`, attendance services, `workforce` services, `expense`/`invoice` (chuyển từ chọn tay → auto-tag), `dashboardService` + edge `platform-data`.
- Forms tạo mới của các module trên: auto-tag entity.
- ~25–35 file. Chia nhiều phase khi lên plan (HR/Att/Payroll → Accounting → CRM/Workforce → Dashboard).

## 6. Testing / verify

- `npm run build` pass từng phase.
- Verify thật localhost:3000: ở TD Consulting tạo nhân viên + phòng ban + chi phí + khoản vay → chuyển về TD Games không thấy; TD Games data cũ nguyên vẹn; Dashboard hợp nhất = tổng 2 bên; role member không thấy switcher.

## Rủi ro / lưu ý

- Payroll đọc chéo att_monthly_sheets + hr_employees: sheet và employee phải cùng entity — auto-tag từ workspace đảm bảo điều này.
- pg_cron (leave accrual, agent-run) chạy toàn bảng — không filter entity, vẫn đúng vì xử lý theo từng employee record.
- Backfill mặc định TD Games: nếu có record thực tế thuộc TD Consulting từ trước, kế toán tag lại tay qua UI (chỉ áp dụng expense/invoice đã có UI tag).
