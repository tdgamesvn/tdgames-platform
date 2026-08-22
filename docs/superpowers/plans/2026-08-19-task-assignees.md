# Plan — Phương án B: 1 task = 1 dòng + bảng con `wf_task_assignees`

_2026-08-19. Trạng thái: chờ sếp duyệt. Chưa sửa file nào._

## 0. Đã xác minh (không phải giả định)

- Prod có đúng **1** task bị tách 2 dòng: `clickup_task_id = 86ewyuf0w`
  (query lại 2026-08-19: vẫn còn nguyên 2 dòng)
  - `c39f5036…` → Phạm Minh Giang, price 6.000.000, payment_status `paid`,
    nghiệm thu `ccb3737f…` client_price **$960** (status `accepted`)
  - `4a44dda1…` → Đặng Thế A, price 0, payment_status `unpaid`,
    nghiệm thu `0e1ab592…` client_price **$960** (status `accepted`)
  - ⇒ 1 task giao khách, sổ ghi **$1.920**. Xác nhận double-count.
  - **Quyết định của sếp: KHÔNG gộp, không sửa.** Khách đã thanh toán rồi,
    coi như lỗi thừa bỏ qua. Data lịch sử để nguyên. Hệ quả ở §1 bước 6.
- `uq_wf_tasks_clickup_worker` có thật, là **partial unique index**
  (`WHERE clickup_task_id IS NOT NULL AND <> ''`), không có trong thư mục
  `supabase/migrations/` → tạo tay trên remote. Sẽ bị bỏ ở bước 1.
- Không có edge function ClickUp. Sync chỉ chạy ở nút bấm tay `TaskList.tsx`.

## 1. Impact (GitNexus) — ⚠️ CẢNH BÁO

| Symbol | Risk | Direct callers | Processes |
|---|---|---|---|
| `fetchTasks` (workforceService) | 🔴 **HIGH** | 4 | 10 (WorkforceApp) |
| `createSettlement` | 🟢 LOW | 1 | 1 |

`fetchTasks` là hub — đổi shape trả về sẽ chạm 10 luồng trong WorkforceApp.
Cách giảm rủi ro: **giữ nguyên chữ ký + giữ nguyên mọi field cũ**, chỉ *thêm*
`assignees[]` vào kết quả. Không đổi/bỏ field nào ở tầng TS.

## 2. Mô hình dữ liệu

```sql
create table wf_task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id   uuid not null references wf_tasks(id) on delete cascade,
  worker_id uuid not null references wf_workers(id) on delete cascade,
  share_pct numeric not null default 100 check (share_pct >= 0 and share_pct <= 100),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  created_at timestamptz default now(),
  unique (task_id, worker_id)
);
```

Nguyên tắc: **task giữ 1 `price` (chi phí) + 1 `client_price` (doanh thu)**.
Con người chỉ là tỉ lệ chia. Phần của worker = `price * share_pct / 100`.

Vì sao `payment_status` phải nằm ở đây: hiện quyết toán của Giang set
`wf_tasks.payment_status = 'paid'` → `SettlementCreateView:56` lọc bỏ task đó
→ Đặng Thế A **không bao giờ quyết toán được** phần của mình. Cùng họ lỗi.

### Điểm lười có chủ đích (cần sếp gật)

`wf_tasks.payment_status` **giữ lại**, do trigger trên `wf_task_assignees`
tự set: `'paid'` khi mọi assignee có `share_pct > 0` đều paid, ngược lại
`'unpaid'`.

- Được: 8 chỗ chỉ-đọc không phải sửa — CEO dashboard (`dashboardService:289,539`),
  2 edge function `platform-data` + `billing-report` (mỗi cái 2 chỗ),
  badge/filter trong TaskList.
- Trần đã biết (sẽ ghi `// ponytail:`): task trả 1 phần → dashboard vẫn tính
  **nguyên** `price` vào "workforce payable". Sai lệch tạm thời, chỉ với task
  nhiều người trả lệch nhau. Nâng cấp khi cần: đổi 4 chỗ đó sang cộng theo
  `share_pct` của assignee chưa paid.

`wf_tasks.worker_id` **bỏ hẳn** sau khi backfill. Giữ lại = 2 nguồn sự thật =
đúng cái mìn phương án B sinh ra để gỡ.

## 3. Các bước

### Bước 1 — Migration `20260819100000_wf_task_assignees.sql`
1. Tạo bảng + index trên (`task_id`), (`worker_id`).
2. Backfill: mỗi `wf_tasks` có `worker_id` → 1 dòng assignee,
   `share_pct = 100`, `payment_status` = của task.
3. ~~Gộp dòng trùng `86ewyuf0w`~~ — **BỎ**. Không đụng data lịch sử.
   2 dòng của `86ewyuf0w` cứ để nguyên, mỗi dòng backfill 1 assignee 100%
   như mọi task khác. Doanh thu ORCA giữ nguyên $1.920 (sếp chấp nhận).
4. Trigger `sync_task_payment_status` trên `wf_task_assignees`
   (INSERT/UPDATE/DELETE) cập nhật `wf_tasks.payment_status`.
5. RLS: `wf_task_assignees_staff_all` (is_staff) +
   `wf_task_assignees_self_read` (`worker_id = my_worker_id()`).
   Sửa `wf_tasks_self_read` từ `worker_id = my_worker_id()` →
   `exists (select 1 from wf_task_assignees a where a.task_id = wf_tasks.id
   and a.worker_id = my_worker_id())`.
6. Drop index `uq_wf_tasks_clickup_worker`. **Không tạo unique index mới** —
   `86ewyuf0w` còn 2 dòng nên `unique (clickup_task_id)` sẽ fail khi tạo.
   Thay bằng index thường `(clickup_task_id)` cho tra cứu.
   Chống trùng chuyển sang tầng sync (bước 4): 1 clickup_task_id chỉ upsert
   1 dòng. `// ponytail: unique index chờ dọn dòng trùng lịch sử; sync đã
   không sinh trùng mới. Bật lại index khi sếp muốn dọn.`
7. Drop `wf_tasks.worker_id` — **để riêng ở migration bước cuối**, sau khi code
   deploy xong (tránh cửa sổ prod chạy code cũ trên schema mới).

### Bước 2 — `types.ts`
```ts
export interface TaskAssignee {
  id?: string; task_id?: string; worker_id: string;
  share_pct: number; payment_status: 'unpaid' | 'paid'; worker?: Worker;
}
```
`WorkforceTask`: bỏ `worker_id`/`worker`, thêm `assignees: TaskAssignee[]`.

### Bước 3 — `workforceService.ts`
- `fetchTasks` — đổi select thành
  `'*, assignees:wf_task_assignees(*, worker:wf_workers(*))'`. Chữ ký giữ nguyên.
- `saveTask(t, assignees)` — insert task rồi insert assignees.
- `setTaskAssignees(taskId, list)` — mới, delete-then-insert (giống
  `updateSettlementTasks` đã có).
- `updateSettlement` khi `status='paid'`: đổi từ update `wf_tasks.payment_status`
  → update `wf_task_assignees.payment_status` **theo đúng `worker_id` của
  settlement** (`.in('task_id', taskIds).eq('worker_id', s.worker_id)`).
  `deleteSettlement` rollback y hệt. Trigger lo phần `wf_tasks`.
- `createSettlement`: `totalAmount` truyền vào đã là số đã chia (tính ở UI).

### Bước 4 — `TaskList.tsx` (nguồn gốc lỗi)
- Sync: bỏ `break` (dòng 154-157 — gốc lỗi). Map **toàn bộ**
  `ct.assignee_emails` → danh sách worker khớp.
  Tra task tồn tại chỉ bằng `clickup_task_id` (bỏ `.eq('worker_id')`).
  - Trả về **>1 dòng** (chỉ `86ewyuf0w` legacy): `skipped++`, `continue`.
    Không đụng, không gộp. `// ponytail:` ghi rõ lý do.
  - Trả về 1 dòng: đồng bộ lại danh sách assignee, **giữ nguyên `share_pct`
    của người đã có** (không đè tay sếp đã chỉnh); người mới thêm vào thì
    chia lại đều cho phần còn trống, người bị gỡ khỏi ClickUp thì xoá.
  - Không có dòng nào: tạo 1 dòng task + n assignee, chia đều
    (`splitShares(n)` — xem dưới).
- Hiển thị: `workerName` (2 chỗ, dòng 435 + 712) → join tên các assignee.
- Nút "Đã TT/Chưa TT" ở dòng 491 + 759: hiện toggle cả task. Đổi thành toggle
  **tất cả** assignee của task (giữ nguyên hành vi 1 người, đúng cho n người).
- Ô sửa giá: `price` giờ là **giá cả task** (xem bước 4b cho phần chia %).

### Bước 4b — Chỉnh % của từng người (sếp yêu cầu, làm cùng bước 4)

Hàm chia mặc định, để trong `workforceService.ts`:

```ts
// Chia đều n người, dư dồn người đầu để tổng luôn = 100
export const splitShares = (n: number): number[] => {
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? 100 - base * (n - 1) : base));
};
// splitShares(3) → [34,33,33]  splitShares(7) → [22,13,13,13,13,13,13]
```

UI — mở rộng **modal sửa giá** đang có trong `TaskList.tsx`, không làm modal mới:

- Task 1 người → không hiện gì (giữ y hệt hôm nay, 100%).
- Task ≥ 2 người → dưới ô giá hiện danh sách assignee, mỗi dòng:
  `[tên]  [input % ]  → [tiền = price × pct / 100]` (tiền cập nhật realtime).
- Dưới cùng: `Tổng: 100%` — xanh khi = 100, đỏ khi ≠ 100. **Nút Lưu disable
  khi tổng ≠ 100** (chặn ở UI; DB đã có `check (share_pct 0..100)` từng dòng).
- Nút **"Chia đều"** reset về `splitShares(n)`.
- Lưu → `setTaskAssignees(taskId, list)` (delete-then-insert), giữ nguyên
  `payment_status` của từng người đang có.

`// ponytail: không ràng tổng = 100 bằng DB constraint — phải viết trigger đếm
lại cả bảng con mỗi lần ghi. Chặn ở UI đủ; thêm trigger khi có luồng ghi khác.`

Self-check (§4): `splitShares(n)` với n = 1,2,3,7 phải luôn `sum === 100`.

### Bước 5 — Quyết toán
- `SettlementCreateView:54-58`: lọc theo assignee thay vì `t.worker_id`, và
  `payment_status` lấy của assignee đó.
- `:104` `selectedPriceTotal` → `price * share_pct / 100`; `bonus` chia cùng tỉ lệ.
- `SettlementDetailView:68-70` + `:131` + `settlementPdfExport.ts:37,57,65` — cùng
  cách. PDF phải in đúng phần của người đó, không phải giá cả task.

### Bước 6 — Chỗ đọc theo worker
- `freelancerPortalService.ts:17-19,70-72` — `.select('*, wf_task_assignees!inner(...)')`
  + `.eq('wf_task_assignees.worker_id', workerId)`, tiền nhân `share_pct`.
- `portalService.ts:240-246` — như trên (không có field tiền, dễ).
- `apps/workforce/dashboardService.ts:250-274` (KPI fulltime) — join qua assignee;
  `revenue += client_price * share_pct / 100` ⇒ **hết cảnh 2 người cùng ăn đủ $960**.
- `useWorkforceState.ts:324` — `wsTasks` lọc sổ theo `t.worker_id`; đổi sang
  "có ít nhất 1 assignee thuộc sổ". `:334` filter theo worker → tương tự.
- `hr/EmployeeDetail.tsx:150` — query `wf_tasks` theo `worker_id`; đổi sang assignee.

### Bước 7 — Migration cuối `20260819110000_drop_wf_tasks_worker_id.sql`
Chỉ chạy **sau khi** bước 2-6 đã deploy prod: `alter table wf_tasks drop column worker_id`.

## 4. Kiểm chứng

- SQL: sau bước 1, `count(*) wf_task_assignees` = `count(*) wf_tasks where
  worker_id is not null` — không mất dòng nào, không thêm dòng nào.
- SQL: `sum(client_price) from wf_project_acceptance_tasks` **không đổi**
  (đã bỏ gộp — số cũ giữ nguyên có chủ đích).
- Self-check `splitShares`: n = 1,2,3,7 → `sum === 100`.
- `npm run build` phải pass.
- `/run` trên localhost:3000: sync ClickUp 1 lần (log phải báo `86ewyuf0w`
  vào `skipped`), mở 1 task nhiều người → chỉnh % → lưu → tạo quyết toán cho
  từng người, xem KPI fulltime.

## 5. Không làm (YAGNI)

- **Không dọn dòng trùng `86ewyuf0w`** — sếp chốt bỏ qua (khách đã thanh toán).
  Kéo theo: không có unique index trên `clickup_task_id`, sync tự skip. Muốn
  dọn sau thì xoá dòng `4a44dda1…` + link nghiệm thu `0e1ab592…` rồi bật index.
- Không tách bonus theo người — chia cùng `share_pct`. Thêm khi sếp cần khác.
- Không sửa 4 chỗ tính `workforce payable` ở CEO dashboard + 2 edge function —
  trigger giữ `wf_tasks.payment_status` cho chúng chạy nguyên. Xem "trần" ở §2.
- Không đụng luồng nghiệm thu (`projectAcceptanceService`) — 1 task = 1 dòng nên
  nó đúng sẵn, đây là điểm ăn tiền của phương án B so với A.
