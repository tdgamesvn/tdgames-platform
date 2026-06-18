# Parking → Inline Vehicle Info (Hướng A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đơn giản hóa thông tin xe từ bảng `hr_parking_registrations` (tab riêng, nhiều xe/nhân viên) thành 4 field inline trong `hr_employees` — đúng pattern bank info.

**Architecture:** Thêm 4 cột `vehicle_type`, `license_plate`, `vehicle_brand`, `vehicle_color` vào bảng `hr_employees`. Xóa tab Gửi xe khỏi Portal và HR. Thêm section inline 🚗 vào ProfileTab (Portal) và EmployeeForm/EmployeeDetail (HR) — giống hệt pattern 🏦 bank info hiện có.

**Tech Stack:** React 19 + TypeScript, Supabase (Postgres), Tailwind + inline styles (dark dashboard), `supabase` MCP tool cho migration.

## Global Constraints

- Dark theme only — background `#0F0F0F`, surface `#1A1A1A`, border `rgba(255,255,255,0.08)`
- Brand color primary: `#FF9500`; không dùng màu mới không có trong style guide
- Tailwind class + `style={{}}` — không tạo file CSS riêng
- Font: Montserrat, `font-black` = weight 900
- Section title ≤ 16px, field label `text-[10px] font-black uppercase tracking-widest text-neutral-medium`
- `inputCls = "w-full bg-transparent border border-primary/10 rounded-xl px-4 py-3 text-white placeholder-neutral-medium/40 focus:outline-none focus:border-cyan-500/40 transition-all text-sm"` (Portal ProfileTab pattern)
- `inputCls` HR = `"w-full bg-white/5 border border-primary/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary/40"` (EmployeeForm pattern)
- `sectionCls = "rounded-[20px] border border-primary/10 bg-[#161616] p-6 md:p-8 space-y-6"` (Portal ProfileTab)
- `sectionCls` HR = dùng `className="rounded-[20px] border border-primary/10 bg-surface p-6 space-y-4"` (EmployeeForm pattern)
- Không dùng `alert()` — dùng `onToast` hoặc console.error
- Không cần unit test (internal dashboard, kiểm tra bằng build + manual)

---

## File Map

| File | Thay đổi |
|------|---------|
| `supabase/migrations/20260618000000_hr_employees_vehicle_columns.sql` | **Tạo mới** — ADD 4 cột vào `hr_employees` |
| `apps/portal/services/portalService.ts` | **Sửa** — thêm vehicle fields vào `EMPLOYEE_EDITABLE_FIELDS` |
| `apps/portal/components/ProfileTab.tsx` | **Sửa** — thêm section 🚗 Xe & Gửi xe sau bank info |
| `apps/portal/components/PortalApp.tsx` | **Sửa** — xóa toàn bộ parking tab |
| `apps/hr/components/EmployeeForm.tsx` | **Sửa** — thêm section 🚗 sau bank info (vehicle fields đã init) |
| `apps/hr/components/EmployeeDetail.tsx` | **Sửa** — xóa parking tab, thêm vehicle display inline |

---

## Task 1: DB Migration — Thêm 4 cột vehicle vào hr_employees

**Files:**
- Create: `supabase/migrations/20260618000000_hr_employees_vehicle_columns.sql`

**Interfaces:**
- Produces: 4 cột mới trong `hr_employees` sẵn sàng cho SELECT/UPDATE

- [ ] **Step 1: Tạo migration file**

```sql
-- supabase/migrations/20260618000000_hr_employees_vehicle_columns.sql
-- Add vehicle info columns to hr_employees (replaces hr_parking_registrations for simple 1-vehicle use case)

ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS vehicle_type    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS license_plate   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_brand   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS vehicle_color   TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN hr_employees.vehicle_type  IS 'Loại xe: motorcycle, car, bicycle, electric_bike, other, hoặc rỗng';
COMMENT ON COLUMN hr_employees.license_plate IS 'Biển số xe';
COMMENT ON COLUMN hr_employees.vehicle_brand IS 'Nhãn hiệu xe (Honda, Yamaha…)';
COMMENT ON COLUMN hr_employees.vehicle_color IS 'Màu xe';
```

- [ ] **Step 2: Apply migration lên Supabase**

Dùng Supabase MCP tool `apply_migration`:
```
name: "hr_employees_vehicle_columns"
query: <nội dung file sql ở trên>
```

Hoặc nếu dùng Supabase CLI:
```bash
npx supabase db push
```

Expected: No error. 4 cột mới xuất hiện trong `hr_employees`.

- [ ] **Step 3: Verify migration**

Dùng Supabase MCP `execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'hr_employees'
  AND column_name IN ('vehicle_type', 'license_plate', 'vehicle_brand', 'vehicle_color');
```

Expected: 4 rows, data_type = `text`, column_default = `''`.

---

## Task 2: portalService.ts — Cho phép lưu vehicle fields

**Files:**
- Modify: `apps/portal/services/portalService.ts` (lines ~126–132)

**Interfaces:**
- Consumes: Task 1 (cột đã tồn tại trong DB)
- Produces: `updateMyProfile` sẽ cho phép lưu `vehicle_type`, `license_plate`, `vehicle_brand`, `vehicle_color`

- [ ] **Step 1: Thêm 4 vehicle fields vào `EMPLOYEE_EDITABLE_FIELDS`**

Tìm đoạn:
```typescript
const EMPLOYEE_EDITABLE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'nationality',
  'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
  'avatar_url', 'id_card_front_url', 'id_card_back_url',
  'tax_code', 'insurance_number',
  'bank_name', 'bank_account', 'bank_branch',
];
```

Thay bằng:
```typescript
const EMPLOYEE_EDITABLE_FIELDS = [
  'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'nationality',
  'address', 'temp_address', 'id_number', 'id_issue_date', 'id_issue_place',
  'avatar_url', 'id_card_front_url', 'id_card_back_url',
  'tax_code', 'insurance_number',
  'bank_name', 'bank_account', 'bank_branch',
  'vehicle_type', 'license_plate', 'vehicle_brand', 'vehicle_color',
];
```

- [ ] **Step 2: Verify bằng build**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi TypeScript.

---

## Task 3: ProfileTab.tsx (Portal) — Thêm section 🚗 Xe & Gửi xe

**Files:**
- Modify: `apps/portal/components/ProfileTab.tsx`

**Interfaces:**
- Consumes: Task 2 (`updateMyProfile` đã cho phép vehicle fields)
- Produces: UI section mới trong hồ sơ nhân viên, sau bank info

**Lưu ý:** `EDITABLE_FIELDS` trong ProfileTab đã có vehicle fields (line 23). `form.vehicle_type` etc. đã được load từ `fetchMyProfile` (SELECT *). Chỉ cần thêm UI.

- [ ] **Step 1: Thêm constant VEHICLE_LABELS vào đầu file** (sau const `sectionCls`):

```typescript
const VEHICLE_LABELS: Record<string, string> = {
  '': '-- Chọn --',
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};
```

- [ ] **Step 2: Thêm section 🚗 sau section 🏦 bank info**

Tìm đoạn kết thúc section bank info:
```tsx
      {/* Bottom save button */}
      {dirty && (
```

Chèn section mới VÀO TRƯỚC đoạn `{/* Bottom save button */}`:
```tsx
      {/* ── Section: Vehicle Info ── */}
      <div className={sectionCls}>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">🚗 Xe & Gửi xe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Loại xe</label>
            <select
              className={inputCls}
              style={{ colorScheme: 'dark' }}
              value={form.vehicle_type || ''}
              onChange={e => updateField('vehicle_type', e.target.value)}
            >
              {Object.entries(VEHICLE_LABELS).map(([k, v]) => (
                <option key={k} value={k} style={{ background: '#1A1A1A' }}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nhãn hiệu xe</label>
            <input
              className={inputCls}
              value={form.vehicle_brand || ''}
              onChange={e => updateField('vehicle_brand', e.target.value)}
              placeholder="Honda, Yamaha, Toyota…"
            />
          </div>
          <div>
            <label className={labelCls}>Màu xe</label>
            <input
              className={inputCls}
              value={form.vehicle_color || ''}
              onChange={e => updateField('vehicle_color', e.target.value)}
              placeholder="Đen, Trắng, Xám…"
            />
          </div>
          <div>
            <label className={labelCls}>Biển số xe</label>
            <input
              className={inputCls}
              value={form.license_plate || ''}
              onChange={e => updateField('license_plate', e.target.value.toUpperCase())}
              placeholder="59A1-123.45"
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Verify bằng build**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi.

---

## Task 4: PortalApp.tsx — Xóa Parking Tab

**Files:**
- Modify: `apps/portal/components/PortalApp.tsx`

**Interfaces:**
- Produces: Tab "Gửi xe" biến mất khỏi Portal navigation

- [ ] **Step 1: Xóa import ParkingTab**

Xóa dòng:
```typescript
import ParkingTab from './ParkingTab';
```

- [ ] **Step 2: Xóa `parking` khỏi PortalTab type**

Thay:
```typescript
type PortalTab = 'directory' | 'payslip' | 'attendance' | 'leave' | 'parking' | 'profile' | 'evaluation' | 'proposals';
```
Bằng:
```typescript
type PortalTab = 'directory' | 'payslip' | 'attendance' | 'leave' | 'profile' | 'evaluation' | 'proposals';
```

- [ ] **Step 3: Xóa parking khỏi TAB_MAP, TAB_LABELS, REVERSE_TAB**

Xóa dòng `parking:    'overview',` khỏi `TAB_MAP`.

Xóa dòng `overview:  'Gửi xe',` khỏi `TAB_LABELS`.

Xóa dòng `overview:  'parking',` khỏi `REVERSE_TAB`.

- [ ] **Step 4: Xóa `parkingEligible` và logic liên quan**

Xóa block:
```typescript
  /** Gửi xe chỉ cho nhân viên Fulltime / Parttime (không áp dụng freelancer). */
  const parkingEligible =
    linkedEmployeeType === 'fulltime' || linkedEmployeeType === 'parttime';
```

Trong `accessibleTabs`, xóa dòng:
```typescript
    if (parkingEligible) tabs.push('overview');
```

Xóa khỏi `useMemo` deps list: `, [parkingEligible]` → `[]` (hoặc deps còn lại).

Xóa block `useEffect` kiểm tra parking eligibility:
```typescript
  useEffect(() => {
    if (linkedEmployeeType === undefined) return;
    if (activeTab === 'parking' && !parkingEligible) {
      setActiveTab('directory');
    }
  }, [activeTab, parkingEligible, linkedEmployeeType]);
```

- [ ] **Step 5: Xóa parking tab rendering block**

Xóa toàn bộ đoạn:
```tsx
          {/* ── Parking Tab ── */}
          {activeTab === 'parking' && (
            ...
          )}
```
(từ `{/* ── Parking Tab ── */}` đến closing `)}` của khối này)

- [ ] **Step 6: Verify bằng build**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi TypeScript.

---

## Task 5: EmployeeForm.tsx (HR) — Thêm section 🚗 Xe & Gửi xe

**Files:**
- Modify: `apps/hr/components/EmployeeForm.tsx`

**Interfaces:**
- Consumes: Task 1 (cột DB đã tồn tại); `form.vehicle_type`, `form.license_plate`, `form.vehicle_brand`, `form.vehicle_color` đã có trong initial state (line 46)
- Produces: HR có thể xem/edit vehicle info khi tạo/sửa nhân viên

**Lưu ý:** `updateEmployee` dùng `Partial<HrEmployee>` spread — tự động include vehicle fields nếu có. `saveEmployee` cũng insert toàn bộ form fields. Không cần thay đổi service functions.

- [ ] **Step 1: Thêm constant VEHICLE_LABELS sau các constant đầu file**

Tìm vị trí sau `const emptyEmployee = {` block (khoảng line 38-49). Thêm sau `const emptyContract`:
```typescript
const VEHICLE_LABELS: Record<string, string> = {
  '': '-- Không có --',
  motorcycle: 'Xe máy',
  car: 'Ô tô',
  bicycle: 'Xe đạp',
  electric_bike: 'Xe máy điện',
  other: 'Khác',
};
```

- [ ] **Step 2: Thêm section 🚗 sau section 🏦 Banking**

Tìm đoạn kết thúc section Banking:
```tsx
        {/* ── Section: Banking ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">🏦 Thông tin Ngân hàng</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            ...
          </div>
        </div>

        {/* ── Section: Notes & Tags ── */}
```

Chèn section mới giữa Banking và Notes & Tags:
```tsx
        {/* ── Section: Vehicle Info ── */}
        <div className={sectionCls}>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">🚗 Xe & Gửi xe</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Loại xe</label>
              <select
                className={inputCls}
                style={{ colorScheme: 'dark' }}
                value={form.vehicle_type}
                onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
              >
                {Object.entries(VEHICLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nhãn hiệu xe</label>
              <input
                className={inputCls}
                value={form.vehicle_brand}
                onChange={e => setForm(f => ({ ...f, vehicle_brand: e.target.value }))}
                placeholder="Honda, Yamaha, Toyota…"
              />
            </div>
            <div>
              <label className={labelCls}>Màu xe</label>
              <input
                className={inputCls}
                value={form.vehicle_color}
                onChange={e => setForm(f => ({ ...f, vehicle_color: e.target.value }))}
                placeholder="Đen, Trắng, Xám…"
              />
            </div>
            <div>
              <label className={labelCls}>Biển số xe</label>
              <input
                className={inputCls}
                value={form.license_plate}
                onChange={e => setForm(f => ({ ...f, license_plate: e.target.value.toUpperCase() }))}
                placeholder="59A1-123.45"
              />
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Verify bằng build**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi.

---

## Task 6: EmployeeDetail.tsx (HR) — Xóa Parking Tab, Thêm Vehicle Display

**Files:**
- Modify: `apps/hr/components/EmployeeDetail.tsx`

**Interfaces:**
- Produces: Tab 🅿️ Gửi xe biến mất; thông tin xe hiển thị inline dưới section Ngân hàng

- [ ] **Step 1: Xóa import ParkingRegistrationSection**

Xóa dòng:
```typescript
import ParkingRegistrationSection from './ParkingRegistrationSection';
```

- [ ] **Step 2: Xóa `parkingCount` state**

Xóa dòng:
```typescript
  const [parkingCount, setParkingCount] = useState(0);
```

- [ ] **Step 3: Xóa parking khỏi initial load**

Tìm đoạn:
```typescript
        const [c, e, p, handovers, parking] = await Promise.all([
          svc.fetchContracts(employee.id),
          svc.fetchEvaluations(employee.id),
          svc.fetchProjectHistory(employee.id),
          office ? svc.fetchEquipmentHandovers(employee.id) : Promise.resolve([]),
          office ? svc.fetchParkingRegistrations(employee.id) : Promise.resolve([]),
        ]);
        setContracts(c);
        setEvaluations(e);
        setProjectHistory(p);
        setEquipmentCount(office ? handovers.length : 0);
        setParkingCount(office ? parking.length : 0);
```

Thay bằng:
```typescript
        const [c, e, p, handovers] = await Promise.all([
          svc.fetchContracts(employee.id),
          svc.fetchEvaluations(employee.id),
          svc.fetchProjectHistory(employee.id),
          office ? svc.fetchEquipmentHandovers(employee.id) : Promise.resolve([]),
        ]);
        setContracts(c);
        setEvaluations(e);
        setProjectHistory(p);
        setEquipmentCount(office ? handovers.length : 0);
```

- [ ] **Step 4: Xóa parking khỏi DetailTab type và tab nav button**

Tìm:
```typescript
type DetailTab = 'info' | 'tasks' | 'contracts' | 'equipment' | 'parking' | 'evaluations' | 'projects' | 'documents' | 'timeline';
```
Thay bằng:
```typescript
type DetailTab = 'info' | 'tasks' | 'contracts' | 'equipment' | 'evaluations' | 'projects' | 'documents' | 'timeline';
```

Tìm và xóa tab button:
```tsx
            <button className={tabCls('parking')} onClick={() => setActiveTab('parking')}>🅿️ Gửi xe ({parkingCount})</button>
```

- [ ] **Step 5: Xóa logic guard parking tab và parking tab content**

Tìm và cập nhật guard (xóa `parking` khỏi điều kiện):
```typescript
    if (!isOfficeStaffType && (activeTab === 'equipment' || activeTab === 'parking')) {
```
Thay bằng:
```typescript
    if (!isOfficeStaffType && activeTab === 'equipment') {
```

Tìm và xóa toàn bộ block parking tab content:
```tsx
      {!loading && isOfficeStaffType && activeTab === 'parking' && (
        <ParkingRegistrationSection employee={employee} onListChange={reloadEquipmentParkingCounts} />
      )}
```

- [ ] **Step 6: Tìm và rename `reloadEquipmentParkingCounts` thành `reloadEquipmentCount`**

Tìm function definition (search `reloadEquipmentParkingCounts`). Đổi tên thành `reloadEquipmentCount` và cập nhật tất cả chỗ gọi nó (thường là 1-2 chỗ). Dùng find-replace trong file vì không dùng GitNexus rename trong task inline.

- [ ] **Step 7: Thêm vehicle display inline sau section Ngân hàng**

Tìm đoạn sau section Ngân hàng (khoảng line 726-731):
```tsx
          <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">Ngân hàng</h3>
            {infoPair('Ngân hàng', employee.bank_name)}
            {infoPair('Số TK', employee.bank_account)}
            {infoPair('Tên chủ TK', employee.bank_branch)}
          </div>
```

Thêm ngay sau đoạn trên:
```tsx
          {(employee.license_plate || employee.vehicle_type) && (
            <div className="rounded-[20px] border border-primary/10 bg-surface p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-medium mb-4">🚗 Xe & Gửi xe</h3>
              {infoPair('Loại xe', ({
                motorcycle: 'Xe máy', car: 'Ô tô', bicycle: 'Xe đạp',
                electric_bike: 'Xe máy điện', other: 'Khác',
              } as Record<string, string>)[employee.vehicle_type] || employee.vehicle_type)}
              {infoPair('Nhãn hiệu', employee.vehicle_brand)}
              {infoPair('Màu xe', employee.vehicle_color)}
              {infoPair('Biển số', employee.license_plate)}
            </div>
          )}
```

- [ ] **Step 8: Verify bằng build**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi TypeScript.

---

## Task 7: Final Verify & Cleanup

- [ ] **Step 1: Full build kiểm tra tất cả tasks**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi.

- [ ] **Step 2: Xóa file ParkingTab.tsx (Portal) — không còn được import**

```bash
rm apps/portal/components/ParkingTab.tsx
```

- [ ] **Step 3: Xóa file ParkingRegistrationSection.tsx (HR) — không còn được import**

```bash
rm apps/hr/components/ParkingRegistrationSection.tsx
```

- [ ] **Step 4: Verify build sau cleanup**

```bash
npm run build
```

Expected: `✓ built in ...` — không có lỗi.

- [ ] **Step 5: Update TASKS.md và LOG.md**

Trong `.agent/meta/TASKS.md`: chuyển task từ Doing → Done.

Trong `.agent/meta/LOG.md`: append entry ngày hôm nay với tóm tắt việc đã làm.
