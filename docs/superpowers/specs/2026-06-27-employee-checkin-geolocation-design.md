# Employee Self-Service Check-in/out — Design Spec

_Created: 2026-06-27_

---

## Context

- **Company:** TD Games, ~10 employees, 1 fixed office location
- **Office:** Tòa Hòa Bình Green City, 505 Minh Khai, Vĩnh Tuy, Hà Nội
- **Default coords:** `lat: 20.9979, lng: 105.8672` (admin có thể chỉnh qua Settings UI)
- **Geo radius:** 300m
- **Work day unit:** 1 day = 8 hours → fractional days (6.7h = 0.8375 ngày)
- **Remote work:** 1 ngày/tuần tối đa, phải xin phép qua `att_requests` trước
- **Existing infrastructure:** `att_records`, `att_shifts`, `att_monthly_records`, `att_qr_sessions` đã có sẵn

---

## Goal

Nhân viên tự chấm công (check-in/out) từ tab "Chấm công" trong Employee Portal, với xác minh GPS để đảm bảo đang ở văn phòng. Không cần phần cứng bổ sung.

---

## Anti-fraud Strategy

| Cơ chế | Mô tả |
|--------|-------|
| **Geofence 300m** | Browser Geolocation API, reject nếu > 300m tính từ tọa độ VP |
| **GPS coords audit** | Lưu `check_in_lat/lng` vào `att_records` để admin đối chiếu |
| **Remote bypass** | Nếu ngày đó có `att_requests` loại remote được approved → bỏ qua geo, `method = 'remote'` |
| **Admin override** | Admin/HR vẫn có thể sửa/thêm record thủ công như hiện tại |

---

## DB Changes

### 1. Alter `att_records`

Thêm 2 cột audit GPS:

```sql
ALTER TABLE att_records
  ADD COLUMN IF NOT EXISTS check_in_lat  FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_lng  FLOAT;
```

### 2. New table: `att_office_config`

Single-row config table:

```sql
CREATE TABLE att_office_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name   TEXT    NOT NULL DEFAULT 'TD Games HQ',
  lat           FLOAT   NOT NULL,
  lng           FLOAT   NOT NULL,
  radius_meters INT     NOT NULL DEFAULT 300,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO att_office_config (office_name, lat, lng, radius_meters)
VALUES ('Hòa Bình Green City – 505 Minh Khai', 20.9979, 105.8672, 300);
```

### 3. RLS on `att_records` (member role)

```sql
-- SELECT: chỉ xem record của chính mình
CREATE POLICY "member_select_own_records"
  ON att_records FOR SELECT
  USING (
    employee_id = (
      SELECT id FROM hr_employees
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );

-- INSERT: chỉ tạo record cho chính mình, method phải là 'geo' hoặc 'remote'
CREATE POLICY "member_insert_own_checkin"
  ON att_records FOR INSERT
  WITH CHECK (
    employee_id = (
      SELECT id FROM hr_employees
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
    AND method IN ('geo', 'remote')
  );

-- UPDATE: chỉ cập nhật check_out trên record của mình (khi check_out còn NULL)
CREATE POLICY "member_checkout_own_record"
  ON att_records FOR UPDATE
  USING (
    employee_id = (
      SELECT id FROM hr_employees
      WHERE auth_user_id = auth.uid()
      LIMIT 1
    )
  );
```

---

## Types (`types.ts`)

```typescript
// New
export interface AttOfficeConfig {
  id: string;
  office_name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  updated_at: string;
}

// Extend AttRecord (add optional fields)
// check_in_lat?: number;
// check_in_lng?: number;
```

---

## Service Layer (`attendanceService.ts`)

### New functions

```typescript
// Fetch office geofence config
fetchOfficeConfig(): Promise<AttOfficeConfig>

// Today's record for the logged-in employee
fetchMyTodayRecord(employeeId: string): Promise<AttRecord | null>

// Range of daily records (for history view)
fetchMyRecordsByRange(employeeId: string, from: string, to: string): Promise<AttRecord[]>

// Self check-in with GPS coords
selfCheckIn(employeeId: string, lat: number, lng: number, method: 'geo' | 'remote'): Promise<AttRecord>

// Self check-out (updates check_out timestamp)
selfCheckOut(recordId: string): Promise<AttRecord>

// Check if employee has an approved remote leave request for a given date
checkRemoteApproved(employeeId: string, date: string): Promise<boolean>

// Update office config (admin only)
updateOfficeConfig(id: string, updates: Partial<AttOfficeConfig>): Promise<void>
```

### Geo utility (pure function, no import needed)

```typescript
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

---

## Frontend — Portal Attendance Tab

### New component: `apps/portal/components/CheckinWidget.tsx`

**States & UI:**

| State | UI |
|-------|----|
| Loading | Spinner nhỏ |
| Not checked in | Big orange button "📍 CHECK IN" |
| GPS requesting | "Đang lấy vị trí…" + spinner |
| GPS denied | Error: "Vui lòng cho phép quyền vị trí" + retry |
| Out of range | Error: "Bạn đang cách VP ~Xm. Cần trong 300m" |
| Checked in | "✅ Vào lúc HH:MM" + live timer + "🏁 CHECK OUT" button |
| Checked out | "✅ Hôm nay: Xh Ym · Y.YY ngày công" |
| Remote day | Badge "🏠 Remote" + allow check-in without geo |

**Work day display:**
```
hours_worked = (check_out_ts - check_in_ts) / 3_600_000
work_day_fraction = (hours_worked / 8).toFixed(2)
// 6h 47m → 6.78h → 0.85 ngày công
```

### Updated: Portal Attendance Tab (in `PortalApp.tsx`)

Layout mới cho tab `attendance`:

```
┌─────────────────────────────────────────┐
│  ⏰ CHẤM CÔNG CỦA TÔI                   │  ← header
├─────────────────────────────────────────┤
│  [CheckinWidget]                        │  ← new, always on top
├─────────────────────────────────────────┤
│  📅 Lịch sử tháng này                   │  ← from att_records
│  Ngày | Vào  | Ra    | Giờ | Ngày công │
│  27/6 | 8:32 | 15:19 | 6h47 | 0.85    │
│  26/6 | 8:45 | 16:01 | 7h16 | 0.91    │
│  ...                                    │
├─────────────────────────────────────────┤
│  📊 Bảng công tháng (HR)                │  ← existing monthly cards, kept
└─────────────────────────────────────────┘
```

### Admin Settings — `apps/attendance/components/ShiftManager.tsx`

Thêm section "📍 Vị trí văn phòng" ở cuối tab Ca làm việc:
- Hiển thị: office_name, lat, lng, radius_meters
- Edit form: input 3 fields + Save button (admin only)

---

## Data Flow Summary

```
Employee checks in (Portal)
  → selfCheckIn() → INSERT att_records {check_in, method='geo', lat, lng}
  → Display: live timer

Employee checks out
  → selfCheckOut() → UPDATE att_records {check_out}
  → Display: Xh Ym · 0.YY ngày công

HR views data
  → Attendance Dashboard shows att_records (todayRecords already loads this)
  → Monthly Sheet: HR reads history tab, manually fills att_monthly_records
     (auto-sync is Phase 2)
```

---

## Out of Scope (Phase 2)

- Auto-aggregate `att_records` → `att_monthly_records.work_days`
- Push notification nhắc check-in buổi sáng
- QR Code mode (infrastructure `att_qr_sessions` đã có, để dành)
- Check-in/out từ Freelancer Portal

---

## Files Affected

| File | Thay đổi |
|------|----------|
| `supabase/migrations/YYYYMMDD_att_checkin_geo.sql` | New — schema changes + RLS |
| `types.ts` | Add `AttOfficeConfig`, extend `AttRecord` |
| `apps/attendance/services/attendanceService.ts` | Add 6 new functions + haversine |
| `apps/portal/components/CheckinWidget.tsx` | New component |
| `apps/portal/components/PortalApp.tsx` | Update attendance tab layout |
| `apps/attendance/components/ShiftManager.tsx` | Add office location settings section |
