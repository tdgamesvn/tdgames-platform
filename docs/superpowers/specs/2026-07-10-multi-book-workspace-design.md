# Design — Multi-book Workspace (Sổ TD Games / Sổ TD Consulting / Hợp nhất)

**Ngày:** 2026-07-10
**Trạng thái:** Approved (đã duyệt qua chat)

---

## Vấn đề

App hiện gộp chung hóa đơn, chi phí, doanh thu của **TD Games** và **TD Consulting**
→ số liệu Dashboard/Expense không khớp với sổ thuế của TD Games. Chi phí TD Consulting
về bản chất thuộc TD Games nhưng chỉ lưu hành nội bộ — thuế/giấy tờ tách riêng hoàn toàn.

## Giải pháp

3 workspace chuyển qua lại, chỉ `admin` + `ke_toan` thấy switcher:

| Workspace | Filter | Ý nghĩa |
|---|---|---|
| **TD Games** (mặc định) | `entity = 'td_games'` | Sổ thực tế — khớp thuế, giấy tờ |
| **TD Consulting** | `entity = 'td_consulting'` | Sổ riêng TD Consulting |
| **Hợp nhất** | không filter | Bức tranh nội bộ đầy đủ (như hiện tại) |

## Thông tin entity TD Consulting

- **Tên:** TD CONSULTING COMPANY LIMITED
- **MST:** 0109898663
- **Địa chỉ:** Xóm Ngoài, Xã Đông Anh, TP Hà Nội
- **Bank:** bổ sung sau (để trống trong constant, sếp cung cấp khi có)

## 1. Data layer

Migration duy nhất, thêm cột vào 3 bảng:

```sql
entity text not null default 'td_games'
  check (entity in ('td_games', 'td_consulting'))
```

- `invoice_invoices`
- `expense_expenses`
- `finance_bank_accounts` (doanh thu TD Consulting nhận về bank riêng)

Backfill tự động: mọi record cũ = `td_games`. Kế toán tag lại record TD Consulting
qua UI (list có filter entity để tag nhanh).

Không đụng bảng khác — payroll/settlement/savings/loan đổ vào expense qua
`source_type` vẫn mặc định `td_games`.

## 2. Workspace switcher

- Dropdown trên **Navbar**, chỉ render khi `hasAnyRole(user, ['admin','ke_toan'])`.
- `WorkspaceContext` (React context) + persist `localStorage`, key ví dụ `workspace_entity`.
- Giá trị: `'td_games' | 'td_consulting' | 'all'`. Mặc định `'td_games'`.
- Các app finance đọc context để build query filter.

## 3. Phạm vi áp filter

| Màn | Thay đổi |
|---|---|
| **Dashboard** (CEO) | Edge function `platform-data` nhận param `entity`; client truyền từ context |
| **Expense** | Form thêm field Entity (pattern y hệt `account_type` sẵn có); list filter theo workspace + badge entity |
| **Invoice** | Form thêm selector Entity. Chọn TD Consulting → auto-fill `studioInfo` từ constant `TD_CONSULTING_STUDIO_INFO` (thay `DEFAULT_INVOICE`). PDF ăn theo `studioInfo` embed sẵn — không sửa template |
| **Bank accounts** (Expense/Accounting) | Field entity khi tạo/sửa tài khoản; list filter theo workspace |

**Ngoài phạm vi (giữ nguyên):** CRM, Workforce, HR, Payroll, Portal, Freelancer Portal.

**E-invoice:** chỉ cho phát hành khi `entity = 'td_games'`. Invoice TD Consulting
là lưu hành nội bộ — nút e-invoice ẩn/disable kèm tooltip.

## 4. Bảo mật / phân quyền

Role ngoài admin/ke_toan vốn không truy cập được Invoice/Expense/Dashboard →
không cần RLS mới. Switcher chỉ ẩn theo role ở UI.

## 5. Ước lượng

1 migration + ~7 file:
`WorkspaceContext` (mới), `Navbar`, Invoice form + list, Expense form + list,
Dashboard, edge function `platform-data`, constant studioInfo TD Consulting.

## 6. Testing / verify

- `npm run build` pass.
- Verify thật trên localhost:3000: tạo expense + invoice cho từng entity,
  chuyển 3 workspace xác nhận số liệu tách đúng; Dashboard đổi theo workspace;
  login role không phải admin/ke_toan không thấy switcher.

## Quyết định đã chốt

1. Invoice có dính TD Consulting → entity ở cả invoice, không chỉ expense.
2. 3 workspace, chỉ admin + ke_toan thấy. Mặc định TD Games.
3. Doanh thu TD Consulting về bank account riêng → tag entity cho `finance_bank_accounts`.
4. Bank TD Consulting bổ sung sau — không chặn implement.
5. Không làm multi-entity đầy đủ (template/e-invoice riêng cho TD Consulting) — YAGNI,
   nâng cấp khi TD Consulting cần phát hành e-invoice từ app.
