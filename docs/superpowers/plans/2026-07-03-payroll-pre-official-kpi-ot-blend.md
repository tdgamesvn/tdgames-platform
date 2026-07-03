# Payroll: Auto-detect KPI/OT lịch sử cho tháng chuyển giao — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng cơ chế "blend lương cũ/mới khi NV lên chính thức giữa tháng" (đã có cho Lương cơ bản) sang thêm 2 khoản Phụ cấp KPI và Tăng ca mặc định, để tránh tính nhầm phần ngày thử việc theo mức lương mới (cao hơn) khi NV đổi mức KPI/OT đúng lúc lên chính thức.

**Architecture:** Tổng quát hoá pattern `preOfficialBaseSalary` đã tồn tại trong `calculatePayroll` (apps/payroll/services/payrollService.ts) thêm 2 input mới `preOfficialKpiAllowance`/`preOfficialDefaultOt`, blend theo đúng công thức `old*probRatio + new*officialRatio`. `createPayrollSheet` tự động detect mức cũ từ lịch sử `hr_employee_salary` (đã có `salaryChangeMap` cho base salary, tổng quát hoá cho cả 3 component). 2 cột DB mới nullable, KHÔNG có UI nhập tay (theo quyết định của sếp — sửa tay thì vào thẳng DB). Cuối cùng vá lại 1 bản ghi lương thực tế bị tính sai (Nguyễn Văn Tú, T6/2026) bằng SQL trực tiếp.

**Tech Stack:** TypeScript (Vite/React, không có test runner trong repo này — dùng `tsc --noEmit` qua `npm run lint` + `npm run build` làm gate, và 1 script Node thuần tạm thời để verify công thức tính toán trước khi sửa DB).

## Global Constraints

- Build check bắt buộc trước khi commit: `npm run build`.
- Không đổi UI (PayrollSheet.tsx, PDF/Excel export) — output field names giữ nguyên.
- Không thêm cột/khoản nào không cần thiết (YAGNI) — chỉ 2 cột `pre_official_kpi_allowance`, `pre_official_default_ot`, mirror y hệt `pre_official_base_salary` (bigint, nullable).
- Migration file theo convention `supabase/migrations/YYYYMMDDHHMMSS_<desc>.sql`, apply qua Supabase MCP (`mcp__supabase__apply_migration`), sau đó file được ghi vào repo để đồng bộ history (giống pattern của `20260707000000_add_bhxh_exempt_pay_payroll_records.sql`).
- Sau khi code + data thay đổi, cập nhật `.agent/meta/TASKS.md` và `.agent/meta/LOG.md` theo Memory Protocol của CLAUDE.md.

---

## File Structure

- Modify: `apps/payroll/services/payrollService.ts` — `PayrollInput` interface, `calculatePayroll`, `createPayrollSheet` (salaryChangeMap generalization), `recalculateRecord`.
- Modify: `types.ts` — `PayPayrollRecord` interface (2 field mới).
- Create: `supabase/migrations/20260707100000_add_pre_official_kpi_ot_pay_payroll_records.sql`
- Data fix (không phải file code): SQL UPDATE trực tiếp trên `pay_payroll_records` cho record của Nguyễn Văn Tú (id `b48c53ab-1fd4-4dcf-bfa0-68e5d64bae77`).

---

### Task 1: DB migration — thêm 2 cột nullable

**Files:**
- Create: `supabase/migrations/20260707100000_add_pre_official_kpi_ot_pay_payroll_records.sql`

**Interfaces:**
- Produces: cột `pay_payroll_records.pre_official_kpi_allowance` (bigint, nullable), `pay_payroll_records.pre_official_default_ot` (bigint, nullable) — Task 3, 4, 5 dùng.

- [ ] **Step 1: Viết migration file**

```sql
-- Mở rộng cơ chế "blend lương cũ/mới tháng chuyển giao" (đã có cho pre_official_base_salary)
-- sang thêm Phụ cấp KPI và Tăng ca mặc định — tránh tính nhầm phần thử việc theo mức mới.
ALTER TABLE pay_payroll_records
  ADD COLUMN IF NOT EXISTS pre_official_kpi_allowance bigint,
  ADD COLUMN IF NOT EXISTS pre_official_default_ot bigint;
```

- [ ] **Step 2: Apply migration qua Supabase MCP**

Dùng `mcp__supabase__apply_migration` với `name: "add_pre_official_kpi_ot_pay_payroll_records"` và nội dung SQL ở Step 1 (migration đi thẳng lên project remote — dự án này không có local Supabase stack).

- [ ] **Step 3: Verify cột đã tồn tại**

Dùng `mcp__supabase__execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'pay_payroll_records'
  and column_name in ('pre_official_kpi_allowance', 'pre_official_default_ot');
```
Expected: 2 rows, `data_type = bigint`, `is_nullable = YES`.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/20260707100000_add_pre_official_kpi_ot_pay_payroll_records.sql
git commit -m "feat(payroll): add pre_official_kpi_allowance/default_ot columns"
```

---

### Task 2: `types.ts` — thêm field vào `PayPayrollRecord`

**Files:**
- Modify: `types.ts:1067` (ngay sau `pre_official_base_salary`)

**Interfaces:**
- Consumes: không có (thuần type declaration)
- Produces: `PayPayrollRecord.pre_official_kpi_allowance?: number | null`, `PayPayrollRecord.pre_official_default_ot?: number | null` — Task 3, 4, 5 dùng.

- [ ] **Step 1: Thêm 2 field**

Sửa đoạn:
```typescript
  /** Lương CB trước khi lên chính thức — chỉ dùng khi tháng chuyển giao + tăng lương. null = cùng mức. */
  pre_official_base_salary?: number | null;
```
thành:
```typescript
  /** Lương CB trước khi lên chính thức — chỉ dùng khi tháng chuyển giao + tăng lương. null = cùng mức. */
  pre_official_base_salary?: number | null;
  /** Phụ cấp KPI trước khi lên chính thức — chỉ dùng khi tháng chuyển giao + đổi mức KPI. null = cùng mức. */
  pre_official_kpi_allowance?: number | null;
  /** Tăng ca mặc định trước khi lên chính thức — chỉ dùng khi tháng chuyển giao + đổi mức tăng ca. null = cùng mức. */
  pre_official_default_ot?: number | null;
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: không lỗi TypeScript liên quan `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add types.ts
git commit -m "feat(payroll): add pre_official_kpi_allowance/default_ot to PayPayrollRecord type"
```

---

### Task 3: `calculatePayroll` — blend KPI + Tăng ca theo tháng chuyển giao

**Files:**
- Modify: `apps/payroll/services/payrollService.ts:18-43` (interface `PayrollInput`)
- Modify: `apps/payroll/services/payrollService.ts:74-85` (blend logic)

**Interfaces:**
- Consumes: `PayPayrollRecord.pre_official_kpi_allowance`, `PayPayrollRecord.pre_official_default_ot` (Task 2)
- Produces: `PayrollInput.preOfficialKpiAllowance?: number | null`, `PayrollInput.preOfficialDefaultOt?: number | null` — Task 4 (recalculateRecord), Task 5 (createPayrollSheet) dùng khi build input.

- [ ] **Step 1: Thêm 2 field vào `PayrollInput`**

Sửa đoạn (dòng 33):
```typescript
  /** Lương CB trước khi lên chính thức. Nếu có và tháng chuyển giao → prorate giữa 2 mức. */
  preOfficialBaseSalary?: number | null;
```
thành:
```typescript
  /** Lương CB trước khi lên chính thức. Nếu có và tháng chuyển giao → prorate giữa 2 mức. */
  preOfficialBaseSalary?: number | null;
  /** Phụ cấp KPI trước khi lên chính thức. Nếu có và tháng chuyển giao → prorate giữa 2 mức. */
  preOfficialKpiAllowance?: number | null;
  /** Tăng ca mặc định trước khi lên chính thức. Nếu có và tháng chuyển giao → prorate giữa 2 mức. */
  preOfficialDefaultOt?: number | null;
```

- [ ] **Step 2: Thêm blend logic cho KPI và Tăng ca**

Sửa đoạn (dòng 74-85):
```typescript
  // Tháng chuyển giao + tăng lương: prorate giữa lương cũ (probation) và lương mới (official)
  const hasPreOfficialSalary = input.preOfficialBaseSalary != null && probRatio > 0 && probRatio < 1;
  const effectiveBaseSalary = hasPreOfficialSalary
    ? r(input.preOfficialBaseSalary! * probRatio + input.baseSalary * officialRatio)
    : input.baseSalary;
  const baseSalaryActual = r(effectiveBaseSalary * ratio);
  const lunchActual = r(input.lunchAllowance * ratio);
  const transportActual = r(input.transportAllowance * ratio);
  const phoneActual = r(input.phoneAllowance * ratio);
  const clothingActual = r(input.clothingAllowance * ratio);
  const kpiActual = r(input.kpiAllowance * ratio);
  const defaultOtActual = r(input.defaultOt * ratio);
```
thành:
```typescript
  // Tháng chuyển giao + đổi mức lương: prorate giữa mức cũ (probation) và mức mới (official).
  // Áp dụng cho cả 3 khoản có thể đổi mức khi lên chính thức: Lương CB, KPI, Tăng ca mặc định.
  const hasPreOfficialSalary = input.preOfficialBaseSalary != null && probRatio > 0 && probRatio < 1;
  const effectiveBaseSalary = hasPreOfficialSalary
    ? r(input.preOfficialBaseSalary! * probRatio + input.baseSalary * officialRatio)
    : input.baseSalary;
  const baseSalaryActual = r(effectiveBaseSalary * ratio);
  const lunchActual = r(input.lunchAllowance * ratio);
  const transportActual = r(input.transportAllowance * ratio);
  const phoneActual = r(input.phoneAllowance * ratio);
  const clothingActual = r(input.clothingAllowance * ratio);

  const hasPreOfficialKpi = input.preOfficialKpiAllowance != null && probRatio > 0 && probRatio < 1;
  const effectiveKpiAllowance = hasPreOfficialKpi
    ? r(input.preOfficialKpiAllowance! * probRatio + input.kpiAllowance * officialRatio)
    : input.kpiAllowance;
  const kpiActual = r(effectiveKpiAllowance * ratio);

  const hasPreOfficialDefaultOt = input.preOfficialDefaultOt != null && probRatio > 0 && probRatio < 1;
  const effectiveDefaultOt = hasPreOfficialDefaultOt
    ? r(input.preOfficialDefaultOt! * probRatio + input.defaultOt * officialRatio)
    : input.defaultOt;
  const defaultOtActual = r(effectiveDefaultOt * ratio);
```

Lưu ý: `grossRef` (dòng 91-92) và `hourlyRate` (dòng 87) giữ nguyên, vẫn dùng `input.kpiAllowance`/`input.defaultOt`/`input.baseSalary` (mức hiện tại) — đây là số tham chiếu "nếu làm full tháng ở mức mới", không đổi theo thiết kế đã duyệt.

- [ ] **Step 3: Verify công thức bằng script Node tạm thời**

Tạo file tạm `/tmp/verify-payroll.mjs` (không commit vào repo):
```javascript
function r(v) { return Math.round(v); }

function calc(input, std = 22, hpd = 8) {
  const ratio = input.workDays / std;
  const probRatio = Math.max(0, Math.min(1, input.probationRatio ?? 0));
  const officialRatio = 1 - probRatio;

  const hasPreOfficialKpi = input.preOfficialKpiAllowance != null && probRatio > 0 && probRatio < 1;
  const effectiveKpiAllowance = hasPreOfficialKpi
    ? r(input.preOfficialKpiAllowance * probRatio + input.kpiAllowance * officialRatio)
    : input.kpiAllowance;
  const kpiActual = r(effectiveKpiAllowance * ratio);

  const hasPreOfficialDefaultOt = input.preOfficialDefaultOt != null && probRatio > 0 && probRatio < 1;
  const effectiveDefaultOt = hasPreOfficialDefaultOt
    ? r(input.preOfficialDefaultOt * probRatio + input.defaultOt * officialRatio)
    : input.defaultOt;
  const defaultOtActual = r(effectiveDefaultOt * ratio);

  const baseSalaryActual = r(input.baseSalary * ratio);
  const lunchActual = r(input.lunchAllowance * ratio);
  const transportActual = r(input.transportAllowance * ratio);
  const phoneActual = r(input.phoneAllowance * ratio);
  const clothingActual = r(input.clothingAllowance * ratio);
  const bonusAmount = input.bonus ?? 0;

  const grossActual = baseSalaryActual + lunchActual + transportActual
    + phoneActual + clothingActual + kpiActual + defaultOtActual + 0 + bonusAmount;
  const taxableIncome = baseSalaryActual + transportActual + phoneActual + kpiActual + bonusAmount;

  return { kpiActual, defaultOtActual, grossActual, taxableIncome };
}

// Case Tú T6/2026: probRatio = 5/11, KPI 2.5tr→4.78tr, OT 400k→2.07tr
const out = calc({
  workDays: 22, probationRatio: 5 / 11, baseSalary: 5310000,
  lunchAllowance: 1000000, transportAllowance: 500000, phoneAllowance: 500000, clothingAllowance: 400000,
  kpiAllowance: 4780000, defaultOt: 2070000, bonus: 2000000,
  preOfficialKpiAllowance: 2500000, preOfficialDefaultOt: 400000,
});
console.log(out);
// Expected: kpiActual=3743636, defaultOtActual=1310909, grossActual=14764545, taxableIncome=12053636

// Sanity: không có preOfficial (case thường) → giữ nguyên hành vi cũ
const out2 = calc({
  workDays: 22, probationRatio: 0, baseSalary: 5000000,
  lunchAllowance: 0, transportAllowance: 0, phoneAllowance: 0, clothingAllowance: 0,
  kpiAllowance: 1000000, defaultOt: 500000, bonus: 0,
});
console.log(out2);
// Expected: kpiActual=1000000, defaultOtActual=500000 (không đổi)
```

Run: `node /tmp/verify-payroll.mjs`
Expected output khớp comment: `{ kpiActual: 3743636, defaultOtActual: 1310909, grossActual: 14764545, taxableIncome: 12053636 }` và `{ kpiActual: 1000000, defaultOtActual: 500000, ... }`.

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: PASS, không lỗi.

- [ ] **Step 5: Commit**

```bash
git add apps/payroll/services/payrollService.ts
git commit -m "feat(payroll): blend pre-official KPI/OT rates for mid-month transition"
```

---

### Task 4: `createPayrollSheet` — tổng quát hoá auto-detect + `recalculateRecord` — đọc field mới

**Files:**
- Modify: `apps/payroll/services/payrollService.ts:419-451` (salaryChangeMap)
- Modify: `apps/payroll/services/payrollService.ts:518-539` (build input + insert row)
- Modify: `apps/payroll/services/payrollService.ts:587-610` (recalculateRecord)

**Interfaces:**
- Consumes: `PayrollInput.preOfficialKpiAllowance`/`preOfficialDefaultOt` (Task 3), `PayPayrollRecord.pre_official_kpi_allowance`/`pre_official_default_ot` (Task 2)
- Produces: DB insert rows với `pre_official_kpi_allowance`, `pre_official_default_ot` populated; `recalculateRecord` output đọc đúng 2 field khi tính lại.

- [ ] **Step 1: Tổng quát hoá `salaryChangeMap` thành detect cho 3 component**

Sửa đoạn (dòng 419-451):
```typescript
  // For transition employees: find old base salary from hr_employee_salary records.
  // saveEmployeeSalary() does INSERT (not upsert), so old probation salary records
  // still exist alongside new official salary records for the same component.
  const salaryChangeMap: Record<string, number> = {};
  if (transitionEmpIds.length > 0) {
    // All "Lương cơ bản" records for transition employees, ordered by created_at
    const { data: baseSalaryHistory } = await supabase
      .from('hr_employee_salary')
      .select('employee_id, amount, created_at, component:hr_salary_components(name)')
      .in('employee_id', transitionEmpIds)
      .order('created_at', { ascending: true });

    // Group by employee → find old base salary (second-to-last "Lương cơ bản" record)
    const empBaseRecords: Record<string, number[]> = {};
    (baseSalaryHistory || []).forEach((s: any) => {
      if (s.component?.name === 'Lương cơ bản' && s.amount > 0) {
        if (!empBaseRecords[s.employee_id]) empBaseRecords[s.employee_id] = [];
        empBaseRecords[s.employee_id].push(s.amount);
      }
    });

    for (const empId of transitionEmpIds) {
      const amounts = empBaseRecords[empId];
      // If there are 2+ records and the latest differs from the previous → salary changed
      if (amounts && amounts.length >= 2) {
        const oldBase = amounts[amounts.length - 2];
        const newBase = amounts[amounts.length - 1];
        if (oldBase !== newBase) {
          salaryChangeMap[empId] = oldBase;
        }
      }
    }
  }
```
thành:
```typescript
  // For transition employees: find old rate (base salary / KPI / default OT) from
  // hr_employee_salary records. saveEmployeeSalary() does INSERT (not upsert), so old
  // probation-era records still exist alongside new official-era records for the same
  // component — we detect a "rate change" by comparing the last 2 records per component.
  const TRACKED_COMPONENTS: Record<string, 'base' | 'kpi' | 'defaultOt'> = {
    'Lương cơ bản': 'base',
    'Phụ cấp năng suất (KPI)': 'kpi',
    'Tăng ca': 'defaultOt',
  };
  const salaryChangeMap: Record<string, Partial<Record<'base' | 'kpi' | 'defaultOt', number>>> = {};
  if (transitionEmpIds.length > 0) {
    // All tracked-component records for transition employees, ordered by created_at
    const { data: salaryHistory } = await supabase
      .from('hr_employee_salary')
      .select('employee_id, amount, created_at, component:hr_salary_components(name)')
      .in('employee_id', transitionEmpIds)
      .order('created_at', { ascending: true });

    // Group by employee + component → amounts in chronological order
    const empComponentRecords: Record<string, Partial<Record<'base' | 'kpi' | 'defaultOt', number[]>>> = {};
    (salaryHistory || []).forEach((s: any) => {
      const key = TRACKED_COMPONENTS[s.component?.name];
      if (!key || !(s.amount > 0)) return;
      const empBucket = empComponentRecords[s.employee_id] || (empComponentRecords[s.employee_id] = {});
      (empBucket[key] || (empBucket[key] = [])).push(s.amount);
    });

    for (const empId of transitionEmpIds) {
      const empBucket = empComponentRecords[empId];
      if (!empBucket) continue;
      (['base', 'kpi', 'defaultOt'] as const).forEach(key => {
        const amounts = empBucket[key];
        // If there are 2+ records and the latest differs from the previous → rate changed
        if (amounts && amounts.length >= 2) {
          const oldAmount = amounts[amounts.length - 2];
          const newAmount = amounts[amounts.length - 1];
          if (oldAmount !== newAmount) {
            (salaryChangeMap[empId] || (salaryChangeMap[empId] = {}))[key] = oldAmount;
          }
        }
      });
    }
  }
```

- [ ] **Step 2: Dùng map mới khi build input + insert row**

Sửa đoạn (dòng 518-539):
```typescript
    // Lương CB trước chính thức (auto-detect từ hr_position_history, hoặc null)
    const preOfficialBaseSalary = (probationRatio > 0 && probationRatio < 1)
      ? (salaryChangeMap[emp.id] ?? null)
      : null;

    const input: PayrollInput = {
      workDays,
      baseSalary: salaryMap.base_salary || 0,
      lunchAllowance: salaryMap.lunch_allowance || 0,
      transportAllowance: salaryMap.transport_allowance || 0,
      phoneAllowance: salaryMap.phone_allowance || 0,
      clothingAllowance: salaryMap.clothing_allowance || 0,
      kpiAllowance: salaryMap.kpi_allowance || 0,
      defaultOt: salaryMap.default_ot || 0,
      extraOtHours,
      dependentsCount: depCountMap[emp.id] || 0,
      isProbation,
      probationRatio,
      preOfficialBaseSalary,
      bonus: 0,
      bhxhExempt,
    };
```
thành:
```typescript
    // Mức lương trước chính thức (auto-detect từ lịch sử hr_employee_salary, hoặc null nếu không đổi)
    const isTransitionMonth = probationRatio > 0 && probationRatio < 1;
    const empSalaryChange = salaryChangeMap[emp.id];
    const preOfficialBaseSalary = isTransitionMonth ? (empSalaryChange?.base ?? null) : null;
    const preOfficialKpiAllowance = isTransitionMonth ? (empSalaryChange?.kpi ?? null) : null;
    const preOfficialDefaultOt = isTransitionMonth ? (empSalaryChange?.defaultOt ?? null) : null;

    const input: PayrollInput = {
      workDays,
      baseSalary: salaryMap.base_salary || 0,
      lunchAllowance: salaryMap.lunch_allowance || 0,
      transportAllowance: salaryMap.transport_allowance || 0,
      phoneAllowance: salaryMap.phone_allowance || 0,
      clothingAllowance: salaryMap.clothing_allowance || 0,
      kpiAllowance: salaryMap.kpi_allowance || 0,
      defaultOt: salaryMap.default_ot || 0,
      extraOtHours,
      dependentsCount: depCountMap[emp.id] || 0,
      isProbation,
      probationRatio,
      preOfficialBaseSalary,
      preOfficialKpiAllowance,
      preOfficialDefaultOt,
      bonus: 0,
      bhxhExempt,
    };
```

Và sửa đoạn insert row (trong cùng hàm, ngay sau, field `pre_official_base_salary: preOfficialBaseSalary,`):
```typescript
      pre_official_base_salary: preOfficialBaseSalary,
      bhxh_exempt: bhxhExempt,
```
thành:
```typescript
      pre_official_base_salary: preOfficialBaseSalary,
      pre_official_kpi_allowance: preOfficialKpiAllowance,
      pre_official_default_ot: preOfficialDefaultOt,
      bhxh_exempt: bhxhExempt,
```

- [ ] **Step 3: `recalculateRecord` đọc 2 field mới**

Sửa đoạn (dòng 587-610):
```typescript
    preOfficialBaseSalary: rec.pre_official_base_salary ?? null,
    // Bonus tính vào TNCT → PIT tự tăng theo bậc lũy tiến
    bonus: rec.bonus ?? 0,
```
thành:
```typescript
    preOfficialBaseSalary: rec.pre_official_base_salary ?? null,
    preOfficialKpiAllowance: rec.pre_official_kpi_allowance ?? null,
    preOfficialDefaultOt: rec.pre_official_default_ot ?? null,
    // Bonus tính vào TNCT → PIT tự tăng theo bậc lũy tiến
    bonus: rec.bonus ?? 0,
```

- [ ] **Step 4: Type-check + build**

Run: `npm run lint && npm run build`
Expected: PASS, không lỗi TypeScript, build thành công.

- [ ] **Step 5: Commit**

```bash
git add apps/payroll/services/payrollService.ts
git commit -m "feat(payroll): auto-detect pre-official KPI/OT rates in createPayrollSheet + recalculateRecord"
```

---

### Task 5: Data fix — bảng lương T6/2026 của Nguyễn Văn Tú

**Files:**
- Không có file code — thao tác trực tiếp trên DB qua `mcp__supabase__execute_sql`.

**Interfaces:**
- Consumes: cột `pre_official_kpi_allowance`/`pre_official_default_ot` (Task 1)

**Bối cảnh:** Record `b48c53ab-1fd4-4dcf-bfa0-68e5d64bae77` (sheet `ef001d81-0483-4e1d-8b99-257830ad2d9e`, status `draft`) hiện có `probation_ratio=5/11≈0.4545`, KPI 4.780.000 (mới), Tăng ca 2.070.000 (mới). Lịch sử `hr_employee_salary` xác nhận mức cũ: KPI 2.500.000, Tăng ca 400.000 (Lương CB không đổi — vẫn 5.310.000 cả 2 lần, nên `pre_official_base_salary` giữ `null`, đúng logic).

Giá trị đã tính tay theo đúng công thức `calculatePayroll` (verify ở Task 3 Step 3, case 1) và đối chiếu ngược với giá trị hiện tại trong DB (khớp 100% với công thức khi `preOfficial=null`, xác nhận phương pháp tính đúng):

| Field | Giá trị cũ (sai) | Giá trị mới (đúng) |
|---|---|---|
| `pre_official_kpi_allowance` | `null` | `2500000` |
| `pre_official_default_ot` | `null` | `400000` |
| `gross_actual` | `16560000` | `14764545` |
| `taxable_income` | `13090000` | `12053636` |
| `pit` | `595000` | `547893` |
| `net_salary` | `15965000` | `14216652` |
| `total_company_cost` | `16560000` | `14764545` |

(`employee_bhxh=0`, `assessable_income=0`, `gross_ref=14560000`, `company_bhxh=0`, `extra_ot=0` — không đổi.)

- [ ] **Step 1: Update record**

```sql
UPDATE pay_payroll_records
SET
  pre_official_kpi_allowance = 2500000,
  pre_official_default_ot = 400000,
  gross_actual = 14764545,
  taxable_income = 12053636,
  pit = 547893,
  net_salary = 14216652,
  total_company_cost = 14764545
WHERE id = 'b48c53ab-1fd4-4dcf-bfa0-68e5d64bae77';
```

- [ ] **Step 2: Verify**

```sql
SELECT pre_official_kpi_allowance, pre_official_default_ot,
       gross_actual, taxable_income, pit, net_salary, total_company_cost
FROM pay_payroll_records
WHERE id = 'b48c53ab-1fd4-4dcf-bfa0-68e5d64bae77';
```
Expected: khớp cột "Giá trị mới (đúng)" ở bảng trên.

- [ ] **Step 3: Báo sếp**

Không cần commit code (data-only). Báo cho sếp: bảng lương T6/2026 của Nguyễn Văn Tú đã sửa, net_salary giảm từ 15.965.000 → 14.216.652 (do phần thử việc trước 15/6 bị tính nhầm theo mức KPI/OT mới). Sheet đang ở trạng thái `draft` nên chưa ảnh hưởng gì đã confirm/paid.

---

### Task 6: Cập nhật Memory Protocol

**Files:**
- Modify: `.agent/meta/TASKS.md`
- Modify: `.agent/meta/LOG.md`

- [ ] **Step 1: Chuyển task sang Done trong TASKS.md, thêm entry mới vào LOG.md**

Nội dung LOG.md entry: mô tả bug, nguyên nhân (chỉ base_salary có cơ chế blend, KPI/OT không có), fix (tổng quát hoá sang 3 component, 2 cột DB mới, auto-detect trong `createPayrollSheet`, không có UI nhập tay theo quyết định sếp), và data fix cho Tú T6/2026 (net giảm 15.965.000 → 14.216.652).

- [ ] **Step 2: Commit**

```bash
git add .agent/meta/TASKS.md .agent/meta/LOG.md
git commit -m "docs: update memory files for payroll pre-official KPI/OT fix"
```

---

## Self-Review Notes

- **Spec coverage:** (1) generalize blend mechanism → Task 3; (2) DB columns → Task 1; (3) auto-detect in createPayrollSheet → Task 4 Step 1-2; (4) recalculateRecord reads new columns → Task 4 Step 3; (5) no manual UI → confirmed, no PayrollSheet.tsx task exists; (6) data fix for Tú → Task 5. All spec items covered.
- **Placeholder scan:** không còn "TBD"/"tương tự Task N" — mọi step đều có code đầy đủ.
- **Type consistency:** `preOfficialKpiAllowance`/`preOfficialDefaultOt` (camelCase, PayrollInput) ↔ `pre_official_kpi_allowance`/`pre_official_default_ot` (snake_case, DB + PayPayrollRecord) dùng nhất quán xuyên suốt Task 2-4.
