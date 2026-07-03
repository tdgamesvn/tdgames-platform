# Nghiệm thu Freelancer theo từng dự án (1 nghiệm thu = 1 dự án)

_Ngày: 2026-07-03_

## Bối cảnh

Màn hình "Tạo nghiệm thu" trong app **Workforce** (`apps/workforce/components/settlement/SettlementCreateView.tsx`) hiện cho phép chọn nhân sự → tick chọn task chưa thanh toán bất kỳ (không phân biệt dự án) → gộp chung vào 1 nghiệm thu (`Settlement` / bảng `wf_settlements`).

Vấn đề: một freelancer có thể làm nhiều dự án (`DACE_Client`, `KABAM_COMPANY`, ...) trong cùng kỳ, và UI hiện tại cho phép nghiệm thu gộp task của nhiều dự án vào 1 phiếu — gây khó khăn khi cần theo dõi/đối chiếu công nợ, doanh thu theo từng dự án riêng biệt.

**Lưu ý phạm vi:** Đây là bảng `wf_settlements` (nghiệm thu thanh toán cho freelancer), khác với bảng `ProjectAcceptance` (nghiệm thu theo dự án với khách hàng) đã có sẵn trong hệ thống — spec này **không đụng tới** `ProjectAcceptance`.

## Yêu cầu

1. Mỗi nghiệm thu freelancer chỉ được chứa task của **đúng 1 dự án**. Không được gộp task nhiều dự án vào 1 nghiệm thu.
2. Nếu freelancer có task ở nhiều dự án trong kỳ, kế toán tạo nhiều nghiệm thu riêng — mỗi nghiệm thu ứng với 1 dự án.
3. Màn hình tạo nghiệm thu có bộ lọc theo dự án.
4. Tên/nhãn hiển thị của nghiệm thu phải thể hiện rõ dự án nào.

## Thiết kế

### 1. Nguồn dữ liệu "dự án"

Dùng field có sẵn `WorkforceTask.project` (string, VD: "Mirai 2 Reskin") làm đơn vị "dự án". Không dùng `client_name` (một client có thể có nhiều dự án).

### 2. Luồng chọn trong SettlementCreateView

Sau khi chọn **Nhân sự**, thêm dropdown **"Dự án"**:
- Liệt kê các giá trị `project` duy nhất từ các task chưa thanh toán (`payment_status !== 'paid'`) của nhân sự đó, kèm số lượng task, VD: `Mirai 2 Reskin (12 task)`.
- Bắt buộc chọn 1 dự án trước khi danh sách task (checkbox) hiển thị. Khi chưa chọn dự án → khu vực chọn task hiện placeholder "Vui lòng chọn dự án".
- Đổi Nhân sự hoặc đổi Dự án → reset `selTaskIds` (giống hành vi reset hiện tại khi đổi filter trạng thái).
- Toàn bộ logic lọc task hiện có (trạng thái đã đóng/tất cả trạng thái, ClickUp status pill, "Hiện tất cả tháng") giữ nguyên, chỉ **thêm điều kiện** `t.project === selProjectName` vào `workerTasks`/`eligibleTasks`.
- Vì task nguồn để chọn đã bị giới hạn theo dự án ngay từ đầu, không cần validate chéo lúc submit — về mặt kỹ thuật không thể tick nhầm task khác dự án.

### 3. Lưu & hiển thị tên dự án trên nghiệm thu

- Thêm cột `project_name text` vào bảng `wf_settlements` (migration SQL mới).
- `Settlement` interface (`types.ts`) thêm `project_name?: string`.
- `createSettlement()` (`workforceService.ts`) nhận thêm tham số `projectName: string`, insert vào cột `project_name`.
- Truyền `projectName` xuyên suốt: `SettlementCreateView.onCreate` → `SettlementManager.onCreateSettlement` → hook tạo settlement (`useWorkforceState.ts` / nơi gọi `createSettlement`).
- Hiển thị:
  - `SettlementListView.tsx`: card hiện `{workerName} · {project_name}` (nếu có `project_name`), nếu không có (nghiệm thu cũ trước migration) chỉ hiện `{workerName}` như hiện tại — không hiện "—" gây rối mắt.
  - `SettlementDetailView.tsx`: hiện tên dự án cạnh tên nhân sự / kỳ nghiệm thu ở phần header chi tiết.
- **Không backfill** dữ liệu cũ (các nghiệm thu tạo trước khi có tính năng này có thể đã gộp nhiều dự án, không xác định được 1 dự án duy nhất) — chỉ áp dụng cho nghiệm thu tạo mới.

### 4. Ngoài phạm vi (out of scope)

- Không đổi `ProjectAcceptance` / luồng nghiệm thu theo dự án với khách hàng.
- Không thêm validate/migrate lại các `Settlement` cũ đã tồn tại.
- Không đổi cơ chế Bonus/Thuế TNCN hiện có.

## File cần sửa

| File | Thay đổi |
|---|---|
| `supabase/migrations/xxxx_add_project_name_to_wf_settlements.sql` | `ALTER TABLE wf_settlements ADD COLUMN project_name text;` |
| `types.ts` | `Settlement.project_name?: string` |
| `apps/workforce/services/workforceService.ts` | `createSettlement(...)` thêm tham số `projectName`, insert cột mới |
| `apps/workforce/components/settlement/SettlementCreateView.tsx` | Thêm dropdown Dự án, lọc task theo dự án, truyền `projectName` khi `onCreate` |
| `apps/workforce/components/SettlementManager.tsx` | Cập nhật signature `onCreateSettlement` truyền qua `projectName` |
| Nơi gọi `createSettlement` (hook state, VD `useWorkforceState.ts` / `WorkforceApp.tsx`) | Cập nhật signature khớp tham số mới |
| `apps/workforce/components/settlement/SettlementListView.tsx` | Hiện tên dự án trên card |
| `apps/workforce/components/settlement/SettlementDetailView.tsx` | Hiện tên dự án ở chi tiết |

## Kiểm thử / Validation

- `npm run build` phải pass (bắt buộc theo CLAUDE.md).
- Tạo nghiệm thu thử cho 1 freelancer có task ở ≥2 dự án: xác nhận không có cách nào tick chọn task khác dự án vào cùng 1 phiếu.
- Xác nhận tên dự án hiển thị đúng trên list card + detail view sau khi tạo nghiệm thu mới.
- Xác nhận nghiệm thu cũ (trước migration) vẫn hiển thị bình thường, không lỗi do `project_name` null.
