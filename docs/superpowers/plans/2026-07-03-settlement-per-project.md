# Nghiệm Thu Freelancer Theo Từng Dự Án — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bắt buộc mỗi nghiệm thu freelancer (`wf_settlements`) chỉ chứa task của đúng 1 dự án, thêm bộ lọc "Dự án" vào màn hình tạo nghiệm thu, và hiển thị tên dự án trên list/detail.

**Architecture:** Thêm cột `project_name` vào `wf_settlements` (migration mới, không backfill). Dùng field có sẵn `WorkforceTask.project` làm đơn vị "dự án" — không dùng `client_name`. Luồng dữ liệu: `SettlementCreateView` (chọn dự án + lọc task) → `onCreate` → `SettlementManager.onCreateSettlement` → `useWorkforceState.handleCreateSettlement` → `workforceService.createSettlement()` (insert `project_name`). Vì task nguồn để chọn đã bị lọc theo dự án từ đầu, không cần validate chéo lúc submit.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres), Vite. Dự án này **không có test framework** (`package.json` chỉ có `build`/`lint` = `tsc --noEmit`, không có test runner) — mỗi task dùng chu trình "sửa code → `npm run lint` → `npm run build`" thay cho TDD unit test, khớp với convention đã dùng xuyên suốt `LOG.md` của dự án.

## Global Constraints

- `npm run build` phải pass trước khi coi bất kỳ task nào là xong (bắt buộc theo CLAUDE.md của dự án).
- Trước khi sửa bất kỳ symbol nào (hàm/component), chạy GitNexus `impact({target: "<tên>", direction: "upstream"})` theo yêu cầu CLAUDE.md của dự án; báo cáo mức rủi ro nếu HIGH/CRITICAL trước khi sửa.
- Không đổi `ProjectAcceptance` / luồng nghiệm thu theo dự án với khách hàng (khác bảng, ngoài phạm vi).
- Không thêm validate/migrate lại các `Settlement` cũ đã tồn tại — chỉ áp dụng cho nghiệm thu tạo mới, `project_name` có thể `null` cho record cũ.
- Không đổi cơ chế Bonus/Thuế TNCN hiện có.
- Migration mới phải áp dụng lên Supabase prod qua MCP (`mcp__supabase__apply_migration`) VÀ lưu file `.sql` tương ứng trong `supabase/migrations/` (đồng bộ lịch sử — pattern đã dùng xuyên suốt dự án, xem `LOG.md`).
- Style: theo `.agent/meta/STYLE_GUIDE.md` — dùng class Tailwind sẵn có trong file đang sửa (`inputCls`, `labelCls`), không bịa pattern mới.

---

### Task 1: DB migration + type — thêm `project_name` vào `wf_settlements`

**Files:**
- Create: `supabase/migrations/20260707110000_add_project_name_to_wf_settlements.sql`
- Modify: `types.ts:202-224` (interface `Settlement`)

**Interfaces:**
- Produces: cột `wf_settlements.project_name` (nullable `text`); `Settlement.project_name?: string` — mọi task sau dùng field này.

- [ ] **Step 1: Viết migration SQL**

Tạo file `supabase/migrations/20260707110000_add_project_name_to_wf_settlements.sql`:

```sql
-- Nghiệm thu freelancer theo từng dự án: mỗi nghiệm thu chỉ chứa task của 1 dự án.
-- Cột này lưu tên dự án (WorkforceTask.project) để hiển thị trên list/detail.
-- Không backfill — nghiệm thu cũ (trước migration) có thể đã gộp nhiều dự án,
-- không xác định được 1 dự án duy nhất nên để NULL.
ALTER TABLE wf_settlements
  ADD COLUMN IF NOT EXISTS project_name text;
```

- [ ] **Step 2: Apply migration lên Supabase prod qua MCP**

Dùng tool `mcp__supabase__apply_migration` với `name: "add_project_name_to_wf_settlements"` và nội dung SQL ở Step 1.

- [ ] **Step 3: Verify cột đã tồn tại**

Dùng `mcp__supabase__execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'wf_settlements' and column_name = 'project_name';
```
Expected: 1 row — `project_name | text | YES`.

- [ ] **Step 4: Thêm field vào `Settlement` interface**

Trong `types.ts`, sửa interface `Settlement` (dòng 202-224), thêm field ngay dưới `notes`:

```typescript
export interface Settlement {
  id?: string;
  worker_id: string;
  worker?: Worker;
  period: string;
  total_tasks: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'paid';
  expense_id: string | null;
  // Bonus trên tổng hoá đơn
  bonus_type: 'percent' | 'amount';
  bonus_value: number;
  bonus_amount: number;
  // Thuế TNCN
  tax_rate: number;
  tax_amount: number;
  net_amount: number;
  notes: string;
  project_name?: string;
  account_type?: 'company' | 'personal';
  created_at?: string;
  tasks?: WorkforceTask[];
}
```

- [ ] **Step 5: Verify TypeScript compile**

Run: `npm run lint`
Expected: 0 errors (chỉ thêm field optional, không phá vỡ chỗ nào dùng `Settlement`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260707110000_add_project_name_to_wf_settlements.sql types.ts
git commit -m "feat(workforce): add project_name column to wf_settlements"
```

---

### Task 2: `workforceService.ts` — `createSettlement()` nhận `projectName`

**Files:**
- Modify: `apps/workforce/services/workforceService.ts:173-220`

**Interfaces:**
- Consumes: `Settlement.project_name?: string` (Task 1).
- Produces: `createSettlement(workerId: string, projectName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType?, bonusValue?, taxRate?, accountType?): Promise<Settlement>` — Task 3 gọi hàm này với đúng thứ tự tham số.

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "createSettlement", direction: "upstream"})`. Kỳ vọng caller duy nhất là `handleCreateSettlement` trong `useWorkforceState.ts` (sẽ sửa ở Task 3) — nếu impact báo thêm caller khác ngoài dự kiến, dừng lại và báo cáo trước khi tiếp tục.

- [ ] **Step 2: Sửa signature + insert**

Trong `apps/workforce/services/workforceService.ts`, thay thế toàn bộ hàm `createSettlement` (dòng 173-220):

```typescript
export async function createSettlement(
  workerId: string,
  projectName: string,
  period: string,
  taskIds: string[],
  totalAmount: number,
  currency: string,
  notes: string,
  bonusType: 'percent' | 'amount' = 'amount',
  bonusValue: number = 0,
  taxRate: number = 10,
  accountType: 'company' | 'personal' = 'company'
): Promise<Settlement> {
  const { bonusAmount, taxAmount, netAmount } = computeSettlementTotals(totalAmount, bonusType, bonusValue, taxRate);

  // 1. Create settlement
  const { data: settlement, error: sErr } = await supabase
    .from('wf_settlements')
    .insert({
      worker_id: workerId,
      project_name: projectName,
      period,
      total_tasks: taskIds.length,
      total_amount: totalAmount,
      currency,
      notes,
      bonus_type: bonusType,
      bonus_value: bonusValue,
      bonus_amount: bonusAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      net_amount: netAmount,
      account_type: accountType,
    })
    .select('*, worker:wf_workers(*)')
    .single();
  if (sErr) throw sErr;

  // 2. Link tasks (NO auto-mark paid — user decides when to mark paid)
  if (taskIds.length > 0) {
    const links = taskIds.map(tid => ({
      settlement_id: settlement.id,
      task_id: tid,
    }));
    const { error: lErr } = await supabase.from('wf_settlement_tasks').insert(links);
    if (lErr) throw lErr;
  }

  return settlement;
}
```

(Chỉ thay đổi: thêm tham số `projectName: string` là tham số thứ 2, và thêm `project_name: projectName` vào object insert. Phần còn lại giữ nguyên y hệt.)

- [ ] **Step 3: Verify TypeScript compile**

Run: `npm run lint`
Expected: lỗi TS ở các call site chưa cập nhật (`useWorkforceState.ts`) — đây là kỳ vọng đúng, sẽ fix ở Task 3. Xác nhận lỗi CHỈ xuất hiện ở đúng dòng gọi `svc.createSettlement(...)`, không có lỗi nào khác trong file `workforceService.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/workforce/services/workforceService.ts
git commit -m "feat(workforce): createSettlement accepts projectName param"
```

---

### Task 3: `useWorkforceState.ts` — truyền `projectName` qua `handleCreateSettlement`

**Files:**
- Modify: `apps/workforce/hooks/useWorkforceState.ts:224-246`

**Interfaces:**
- Consumes: `svc.createSettlement(workerId, projectName, period, taskIds, ...)` (Task 2).
- Produces: `handleCreateSettlement(workerId: string, projectName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType?, bonusValue?, taxRate?, accountType?): Promise<void>` — Task 4 (`SettlementManager`) khai báo prop type khớp hàm này.

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "handleCreateSettlement", direction: "upstream"})`. Kỳ vọng caller duy nhất là `SettlementManager` (qua prop `onCreateSettlement={state.handleCreateSettlement}` trong `WorkforceApp.tsx`).

- [ ] **Step 2: Sửa signature**

Trong `apps/workforce/hooks/useWorkforceState.ts`, thay thế hàm `handleCreateSettlement` (dòng 224-246):

```typescript
  // ── Settlement ──
  const handleCreateSettlement = async (
    workerId: string,
    projectName: string,
    period: string,
    taskIds: string[],
    totalAmount: number,
    currency: string,
    notes: string,
    bonusType: 'percent' | 'amount' = 'amount',
    bonusValue: number = 0,
    taxRate: number = 10,
    accountType: 'company' | 'personal' = 'company'
  ) => {
    try {
      const saved = await svc.createSettlement(workerId, projectName, period, taskIds, totalAmount, currency, notes, bonusType, bonusValue, taxRate, accountType);
      setSettlements(prev => [saved, ...prev]);
      // Refresh tasks since they've been marked approved
      const updatedTasks = await svc.fetchTasks();
      setTasks(updatedTasks);
      setToast({ message: 'Đã tạo nghiệm thu', type: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, type: 'error' });
    }
  };
```

- [ ] **Step 3: Verify TypeScript compile**

Run: `npm run lint`
Expected: lỗi TS còn lại chỉ ở `SettlementManager.tsx` (prop type `onCreateSettlement` chưa khớp) — sẽ fix ở Task 4.

- [ ] **Step 4: Commit**

```bash
git add apps/workforce/hooks/useWorkforceState.ts
git commit -m "feat(workforce): handleCreateSettlement threads projectName through"
```

---

### Task 4: `SettlementManager.tsx` — cập nhật prop type `onCreateSettlement`

**Files:**
- Modify: `apps/workforce/components/SettlementManager.tsx:13`

**Interfaces:**
- Consumes: `handleCreateSettlement` signature (Task 3).
- Produces: prop `onCreate` truyền xuống `SettlementCreateView` với signature mới — Task 5 khai báo `onCreate` khớp.

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "SettlementManager", direction: "upstream"})`. Kỳ vọng caller duy nhất là `WorkforceApp.tsx`.

- [ ] **Step 2: Sửa type**

Trong `apps/workforce/components/SettlementManager.tsx`, dòng 13, thay:

```typescript
  onCreateSettlement: (workerId: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType: 'percent' | 'amount', bonusValue: number, taxRate: number, accountType: 'company' | 'personal') => void;
```

thành:

```typescript
  onCreateSettlement: (workerId: string, projectName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType: 'percent' | 'amount', bonusValue: number, taxRate: number, accountType: 'company' | 'personal') => void;
```

Không cần sửa gì khác trong file này — `onCreate={onCreateSettlement}` (dòng 70) truyền thẳng, tự khớp type mới.

- [ ] **Step 3: Verify TypeScript compile**

Run: `npm run lint`
Expected: lỗi TS còn lại chỉ ở `SettlementCreateView.tsx` (prop `onCreate` + logic `handleCreate` chưa khớp) — sẽ fix ở Task 5.

- [ ] **Step 4: Commit**

```bash
git add apps/workforce/components/SettlementManager.tsx
git commit -m "feat(workforce): SettlementManager onCreateSettlement type includes projectName"
```

---

### Task 5: `SettlementCreateView.tsx` — dropdown "Dự án" + lọc task theo dự án

**Files:**
- Modify: `apps/workforce/components/settlement/SettlementCreateView.tsx`

**Interfaces:**
- Consumes: `WorkforceTask.project: string` (có sẵn, `types.ts:173`); prop `onCreate` với signature mới (Task 4).
- Produces: gọi `onCreate(selWorkerId, selProjectName, selPeriod, selTaskIds, ...)` — hoàn tất chuỗi truyền `projectName`.

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "SettlementCreateView", direction: "upstream"})`. Kỳ vọng caller duy nhất là `SettlementManager` (Task 4, đã sửa).

- [ ] **Step 2: Thêm state `selProjectName`, reset khi đổi Nhân sự**

Trong `apps/workforce/components/settlement/SettlementCreateView.tsx`, dòng 35 (`const [selWorkerId, setSelWorkerId] = useState('');`), thêm ngay dưới:

```typescript
  const [selWorkerId, setSelWorkerId] = useState('');
  const [selProjectName, setSelProjectName] = useState('');
```

- [ ] **Step 3: Tính `projectOptions` + tách task theo dự án**

Thay khối từ dòng 53 (`const workerTasks = tasks.filter(...)`) đến dòng 60 (`const availableClickupStatuses = ...`):

Code cũ:
```typescript
  const workerTasks = tasks.filter(t => {
    if (t.worker_id !== selWorkerId) return false;
    if (t.payment_status === 'paid') return false;
    return true;
  });

  // Available ClickUp statuses from worker's tasks
  const availableClickupStatuses = [...new Set(workerTasks.map(t => t.clickup_status).filter(Boolean))].sort() as string[];
```

Code mới:
```typescript
  const workerTasks = tasks.filter(t => {
    if (t.worker_id !== selWorkerId) return false;
    if (t.payment_status === 'paid') return false;
    return true;
  });

  // Unique project names among worker's unpaid tasks, with task counts
  const projectCounts: Record<string, number> = {};
  workerTasks.forEach(t => { if (t.project) projectCounts[t.project] = (projectCounts[t.project] || 0) + 1; });
  const projectOptions = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);

  // Tasks scoped to the selected project (empty until a project is chosen)
  const workerProjectTasks = selProjectName ? workerTasks.filter(t => t.project === selProjectName) : [];

  // Available ClickUp statuses from worker's tasks in the selected project
  const availableClickupStatuses = [...new Set(workerProjectTasks.map(t => t.clickup_status).filter(Boolean))].sort() as string[];
```

- [ ] **Step 4: Đổi nguồn của `eligibleTasks` sang `workerProjectTasks`**

Dòng 62, đổi `const eligibleTasks = workerTasks.filter(t => {` thành `const eligibleTasks = workerProjectTasks.filter(t => {` (thân hàm filter giữ nguyên y hệt, không đổi gì bên trong).

- [ ] **Step 5: Reset `selTaskIds` khi đổi Dự án; reset `selProjectName` khi đổi Nhân sự**

Dòng 82-87 (`toggleClickupStatus`) giữ nguyên. Thêm hàm mới ngay sau `toggleClickupStatus`:

```typescript
  const changeProject = (name: string) => {
    setSelProjectName(name);
    setSelTaskIds([]);
  };
```

- [ ] **Step 6: Thêm dropdown "Dự án" trong JSX, sửa handler đổi Nhân sự**

Dòng 127, đổi:
```typescript
            <select className={inputCls} value={selWorkerId} onChange={e => { setSelWorkerId(e.target.value); setSelTaskIds([]); }}>
```
thành (reset cả `selProjectName`):
```typescript
            <select className={inputCls} value={selWorkerId} onChange={e => { setSelWorkerId(e.target.value); setSelProjectName(''); setSelTaskIds([]); }}>
```

Ngay sau khối `{/* Status Filter Toggle */}` mở đầu ở dòng 144-145 (`{selWorkerId && (`), CHÈN một block mới TRƯỚC nó (giữa dòng 142 `</div>` đóng grid 3 cột, và dòng 144 comment Status Filter Toggle):

```tsx
        {/* Project Filter */}
        {selWorkerId && (
          <div>
            <label className={labelCls}>Dự án *</label>
            <select className={inputCls + ' md:w-1/3'} value={selProjectName} onChange={e => changeProject(e.target.value)}>
              <option value="">-- Chọn dự án --</option>
              {projectOptions.map(([name, count]) => (
                <option key={name} value={name}>{name} ({count} task)</option>
              ))}
            </select>
            {projectOptions.length === 0 && (
              <p className="text-[10px] text-neutral-medium/50 mt-2">Nhân sự này không có task chưa thanh toán nào.</p>
            )}
          </div>
        )}

```

- [ ] **Step 7: Placeholder "Vui lòng chọn dự án" khi chưa chọn**

Dòng 229-234, đổi:
```tsx
            {eligibleTasks.length === 0 ? (
              <p className="text-neutral-medium text-sm py-4 text-center">
                {showAllTasks
                  ? 'Không có task chưa thanh toán nào cho nhân sự này'
                  : `Không có task khả dụng cho nhân sự này trong kỳ ${selPeriod}`}
              </p>
            ) : (
```
thành:
```tsx
            {eligibleTasks.length === 0 ? (
              <p className="text-neutral-medium text-sm py-4 text-center">
                {!selProjectName
                  ? 'Vui lòng chọn dự án'
                  : showAllTasks
                  ? 'Không có task chưa thanh toán nào cho nhân sự này trong dự án này'
                  : `Không có task khả dụng cho dự án này trong kỳ ${selPeriod}`}
              </p>
            ) : (
```

- [ ] **Step 8: Truyền `selProjectName` trong `handleCreate`**

Dòng 108-114, đổi:
```typescript
  const handleCreate = () => {
    if (!selWorkerId || selTaskIds.length === 0) return;
    const currency = dominantCurrency;
    const accountType = selTaxRate === 0 ? 'personal' : 'company';
    onCreate(selWorkerId, selPeriod, selTaskIds, selectedTotal, currency, selNotes, selBonusType, selBonusValue, selTaxRate, accountType as 'company' | 'personal');
    onBack();
  };
```
thành:
```typescript
  const handleCreate = () => {
    if (!selWorkerId || !selProjectName || selTaskIds.length === 0) return;
    const currency = dominantCurrency;
    const accountType = selTaxRate === 0 ? 'personal' : 'company';
    onCreate(selWorkerId, selProjectName, selPeriod, selTaskIds, selectedTotal, currency, selNotes, selBonusType, selBonusValue, selTaxRate, accountType as 'company' | 'personal');
    onBack();
  };
```

- [ ] **Step 9: Sửa prop type `onCreate`**

Dòng 14, đổi:
```typescript
  onCreate: (workerId: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType: 'percent' | 'amount', bonusValue: number, taxRate: number, accountType: 'company' | 'personal') => void;
```
thành:
```typescript
  onCreate: (workerId: string, projectName: string, period: string, taskIds: string[], totalAmount: number, currency: string, notes: string, bonusType: 'percent' | 'amount', bonusValue: number, taxRate: number, accountType: 'company' | 'personal') => void;
```

- [ ] **Step 10: Verify build sạch toàn bộ**

Run: `npm run lint && npm run build`
Expected: 0 lỗi TypeScript — đây là điểm chuỗi type đã khớp lại hoàn toàn từ `SettlementCreateView` → `SettlementManager` → `useWorkforceState` → `workforceService`.

- [ ] **Step 11: Manual verification (thay unit test vì dự án không có test runner)**

Chạy `npm run dev`, vào app Workforce → tab Nghiệm Thu → "Tạo nghiệm thu":
1. Chọn 1 nhân sự có task ở ≥2 dự án khác nhau (tra bằng SQL nếu cần: `select worker_id, project, count(*) from wf_tasks where payment_status != 'paid' group by 1,2 having count(distinct project) over (partition by worker_id) > 1` qua `mcp__supabase__execute_sql`).
2. Xác nhận khu vực chọn task hiện "Vui lòng chọn dự án" khi chưa chọn dự án.
3. Chọn 1 dự án → xác nhận danh sách task chỉ hiện task của đúng dự án đó (không có task dự án khác).
4. Đổi sang dự án khác → xác nhận danh sách task đổi theo, `selTaskIds` reset về rỗng.
5. Đổi Nhân sự → xác nhận dropdown Dự án reset về "-- Chọn dự án --".

- [ ] **Step 12: Commit**

```bash
git add apps/workforce/components/settlement/SettlementCreateView.tsx
git commit -m "feat(workforce): scope settlement creation to a single project"
```

---

### Task 6: `SettlementListView.tsx` — hiện tên dự án trên card

**Files:**
- Modify: `apps/workforce/components/settlement/SettlementListView.tsx:92-96`

**Interfaces:**
- Consumes: `Settlement.project_name?: string` (Task 1).

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "SettlementListView", direction: "upstream"})`. Kỳ vọng caller duy nhất là `SettlementManager`.

- [ ] **Step 2: Sửa card header**

Dòng 92-96, đổi:
```tsx
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-bold text-base">{workerName}</p>
                      <p className="text-neutral-medium text-xs mt-0.5">Kỳ: {s.period}</p>
                    </div>
```
thành:
```tsx
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-bold text-base">{workerName}{s.project_name ? ` · ${s.project_name}` : ''}</p>
                      <p className="text-neutral-medium text-xs mt-0.5">Kỳ: {s.period}</p>
                    </div>
```

(Nghiệm thu cũ không có `project_name` → chuỗi rỗng, chỉ hiện `{workerName}` như hiện tại, không hiện "—".)

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: 0 lỗi.

- [ ] **Step 4: Commit**

```bash
git add apps/workforce/components/settlement/SettlementListView.tsx
git commit -m "feat(workforce): show project name on settlement list card"
```

---

### Task 7: `SettlementDetailView.tsx` — hiện tên dự án ở header chi tiết

**Files:**
- Modify: `apps/workforce/components/settlement/SettlementDetailView.tsx:154-157`

**Interfaces:**
- Consumes: `Settlement.project_name?: string` (Task 1), state `s` (Settlement hiện tại trong component).

- [ ] **Step 1: Chạy GitNexus impact trước khi sửa**

Chạy `impact({target: "SettlementDetailView", direction: "upstream"})`. Kỳ vọng caller duy nhất là `SettlementManager`.

- [ ] **Step 2: Sửa header**

Dòng 154-157, đổi:
```tsx
        <div className="flex-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Nghiệm Thu</h2>
          <p className="text-neutral-medium text-sm">{workerName} — Kỳ {s.period}</p>
        </div>
```
thành:
```tsx
        <div className="flex-1">
          <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Nghiệm Thu</h2>
          <p className="text-neutral-medium text-sm">{workerName}{s.project_name ? ` · ${s.project_name}` : ''} — Kỳ {s.period}</p>
        </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: 0 lỗi TypeScript, build thành công (đây là task cuối — build phải sạch toàn bộ luồng).

- [ ] **Step 4: Manual verification cuối**

Trong `npm run dev`: mở 1 nghiệm thu MỚI tạo ở Task 5 → xác nhận tên dự án hiện đúng ở cả card list (Task 6) và header detail (task này). Mở 1 nghiệm thu CŨ (tạo trước migration) → xác nhận không có lỗi hiển thị, không hiện "—" hay "undefined".

- [ ] **Step 5: Commit**

```bash
git add apps/workforce/components/settlement/SettlementDetailView.tsx
git commit -m "feat(workforce): show project name on settlement detail header"
```

---

## Sau khi hoàn tất tất cả task

- [ ] Chạy `detect_changes()` (GitNexus) so với `main` để xác nhận chỉ các symbol dự kiến (`createSettlement`, `handleCreateSettlement`, `SettlementManager`, `SettlementCreateView`, `SettlementListView`, `SettlementDetailView`, interface `Settlement`) bị ảnh hưởng — không có thay đổi ngoài ý muốn ở `ProjectAcceptance` hay module khác.
- [ ] Cập nhật `.agent/meta/TASKS.md` (chuyển task này Doing → Done) và `.agent/meta/LOG.md` (dated entry) theo Memory Protocol của CLAUDE.md.
