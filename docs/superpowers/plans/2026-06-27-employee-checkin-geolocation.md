# Employee Self-Service Check-in/out (Geolocation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable employees to self-service check-in/out from the Portal app using browser GPS to verify they are within 300m of the company office.

**Architecture:** A new `att_office_config` table stores office coordinates. Employees call `selfCheckIn()` from the Portal which validates GPS distance via the Haversine formula before inserting an `att_records` row. A new `CheckinWidget` component in PortalApp handles all UI states (not checked in → GPS requesting → validated → checked in → checked out).

**Tech Stack:** React 19 + TypeScript, Supabase (PostgreSQL + RLS), Browser Geolocation API, Tailwind CSS / inline styles following existing Portal patterns.

## Global Constraints

- Follow existing Portal inline style patterns (NOT Tailwind classes) — see `PortalApp.tsx` payslip tab for reference
- `npm run build` must pass with 0 TypeScript errors after every task
- Migration filename format: `YYYYMMDDHHMMSS_description.sql` in `supabase/migrations/`
- RLS pattern: `employee_id IN (SELECT e.id FROM public.hr_employees e WHERE e.auth_user_id = auth.uid())` (see `20260510140000_hr_parking_self_service_rls.sql`)
- Never hardcode office config in frontend — always fetch from `att_office_config` table
- `AttRecord.method` union must include `'geo'` and `'remote'` after Task 1

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260627000000_att_checkin_geo.sql` | Create | DB schema + RLS |
| `types.ts` | Modify | `AttOfficeConfig` interface + extend `AttRecord.method` |
| `apps/attendance/services/attendanceService.ts` | Modify | 6 new service functions + `haversineDistance` |
| `apps/portal/components/CheckinWidget.tsx` | Create | Self-contained check-in/out UI component |
| `apps/portal/components/PortalApp.tsx` | Modify | Wire CheckinWidget + daily history into attendance tab |
| `apps/attendance/components/ShiftManager.tsx` | Modify | Add office location settings section at bottom |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260627000000_att_checkin_geo.sql`

**Interfaces:**
- Produces: `att_office_config` table, `check_in_lat`/`check_in_lng` columns on `att_records`, RLS policies for member self-service check-in

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260627000000_att_checkin_geo.sql

-- ── 1. Add GPS audit columns to att_records ─────────────────
ALTER TABLE public.att_records
  ADD COLUMN IF NOT EXISTS check_in_lat  FLOAT,
  ADD COLUMN IF NOT EXISTS check_in_lng  FLOAT;

-- ── 2. Office config table (single row) ─────────────────────
CREATE TABLE IF NOT EXISTS public.att_office_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_name   TEXT    NOT NULL DEFAULT 'TD Games HQ',
  lat           FLOAT   NOT NULL,
  lng           FLOAT   NOT NULL,
  radius_meters INT     NOT NULL DEFAULT 300,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default: Hòa Bình Green City, 505 Minh Khai, Vĩnh Tuy, HN
INSERT INTO public.att_office_config (office_name, lat, lng, radius_meters)
VALUES ('Hòa Bình Green City – 505 Minh Khai', 20.9979, 105.8672, 300)
ON CONFLICT DO NOTHING;

-- ── 3. RLS on att_office_config (read-only for all authenticated) ──
ALTER TABLE public.att_office_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_office_config_read_authenticated" ON public.att_office_config;
CREATE POLICY "att_office_config_read_authenticated"
  ON public.att_office_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "att_office_config_update_admin" ON public.att_office_config;
CREATE POLICY "att_office_config_update_admin"
  ON public.att_office_config FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr')
  );

-- ── 4. RLS on att_records for member self-service ────────────
-- NOTE: att_records may already have RLS enabled from earlier migrations.
-- These policies are additive (DROP IF EXISTS prevents conflicts).

ALTER TABLE public.att_records ENABLE ROW LEVEL SECURITY;

-- SELECT: member sees only their own records
DROP POLICY IF EXISTS "att_records_member_select_own" ON public.att_records;
CREATE POLICY "att_records_member_select_own"
  ON public.att_records FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr', 'ke_toan')
  );

-- INSERT: member can create their own record, method must be 'geo' or 'remote'
DROP POLICY IF EXISTS "att_records_member_insert_geo" ON public.att_records;
CREATE POLICY "att_records_member_insert_geo"
  ON public.att_records FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    AND method IN ('geo', 'remote')
  );

-- UPDATE: member can update check_out on their own record
DROP POLICY IF EXISTS "att_records_member_update_checkout" ON public.att_records;
CREATE POLICY "att_records_member_update_checkout"
  ON public.att_records FOR UPDATE
  TO authenticated
  USING (
    employee_id IN (
      SELECT e.id FROM public.hr_employees e
      WHERE e.auth_user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr')
  );
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above, or run:
```bash
supabase db push
```
Expected: migration applied with no errors.

- [ ] **Step 3: Verify in Supabase**

Run this SQL to confirm:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'att_records' AND column_name IN ('check_in_lat', 'check_in_lng');

SELECT * FROM att_office_config LIMIT 1;
```
Expected: 2 rows for att_records columns, 1 row in att_office_config with lat=20.9979.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627000000_att_checkin_geo.sql
git commit -m "feat(att): add geo check-in schema — att_office_config + GPS cols + RLS"
```

---

## Task 2: Types + Service Functions

**Files:**
- Modify: `types.ts` (lines ~895–913 for `AttRecord`, after line 913 for new interface)
- Modify: `apps/attendance/services/attendanceService.ts` (append to end of file)

**Interfaces:**
- Consumes: `att_office_config` table, `att_records` table with new columns, `att_requests` with `leave_type = 'remote'`
- Produces:
  - `AttOfficeConfig` interface (exported from `types.ts`)
  - `AttRecord.method` extended to `'manual' | 'qr' | 'wifi' | 'geo' | 'remote'`
  - `AttRecord.check_in_lat?: number`, `AttRecord.check_in_lng?: number`
  - `haversineDistance(lat1, lng1, lat2, lng2): number`
  - `fetchOfficeConfig(): Promise<AttOfficeConfig>`
  - `fetchMyTodayRecord(employeeId: string): Promise<AttRecord | null>`
  - `fetchMyRecordsByRange(employeeId: string, from: string, to: string): Promise<AttRecord[]>`
  - `selfCheckIn(employeeId: string, lat: number, lng: number, method: 'geo' | 'remote'): Promise<AttRecord>`
  - `selfCheckOut(recordId: string): Promise<AttRecord>`
  - `checkRemoteApproved(employeeId: string, date: string): Promise<boolean>`
  - `fetchOfficeConfig` and `updateOfficeConfig` also exported for admin ShiftManager

- [ ] **Step 1: Update `AttRecord` method union and add GPS fields in `types.ts`**

Find the `AttRecord` interface (around line 895). Change `method` and add 2 optional fields:

```typescript
export interface AttRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  method: 'manual' | 'qr' | 'wifi' | 'geo' | 'remote';  // ADD 'geo' | 'remote'
  shift_id: string | null;
  status: 'present' | 'late' | 'early_leave' | 'absent' | 'half_day';
  late_minutes: number;
  early_minutes: number;
  overtime_minutes: number;
  note: string;
  approved_by: string | null;
  created_at: string;
  // GPS audit (geo check-in only)
  check_in_lat?: number;    // ADD
  check_in_lng?: number;    // ADD
  // joined
  employee?: HrEmployee;
  shift?: AttShift;
}
```

- [ ] **Step 2: Add `AttOfficeConfig` interface to `types.ts`**

Append after the `AttRecord` interface block (after the `// ── Attendance` section, before the next section):

```typescript
export interface AttOfficeConfig {
  id: string;
  office_name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  updated_at: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npm run build 2>&1 | head -30
```
Expected: 0 errors. Any error about `method` type means the union wasn't updated correctly.

- [ ] **Step 4: Add service functions to `attendanceService.ts`**

Append to the end of `apps/attendance/services/attendanceService.ts`:

```typescript
// ══════════════════════════════════════════════════════════
// ── Geo Check-in Self-Service ─────────────────────────────
// ══════════════════════════════════════════════════════════

/**
 * Haversine distance between two GPS points. Returns meters.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fetch the single office geofence config row. */
export async function fetchOfficeConfig(): Promise<import('@/types').AttOfficeConfig> {
  const { data, error } = await supabase
    .from('att_office_config')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

/** Update office config (admin only — enforced by RLS). */
export async function updateOfficeConfig(
  id: string,
  updates: Partial<Omit<import('@/types').AttOfficeConfig, 'id' | 'updated_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('att_office_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Fetch today's att_record for the given employee (null if not checked in yet). */
export async function fetchMyTodayRecord(
  employeeId: string
): Promise<import('@/types').AttRecord | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('att_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Fetch daily att_records in a date range for an employee (for history view). */
export async function fetchMyRecordsByRange(
  employeeId: string,
  from: string,
  to: string
): Promise<import('@/types').AttRecord[]> {
  const { data, error } = await supabase
    .from('att_records')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Self check-in: insert a new att_record for today.
 * method = 'geo' for office check-in, 'remote' for approved WFH day.
 * GPS coords are stored for audit (geo only).
 */
export async function selfCheckIn(
  employeeId: string,
  lat: number,
  lng: number,
  method: 'geo' | 'remote'
): Promise<import('@/types').AttRecord> {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_records')
    .insert({
      employee_id: employeeId,
      date: today,
      check_in: now,
      method,
      check_in_lat: method === 'geo' ? lat : null,
      check_in_lng: method === 'geo' ? lng : null,
      status: 'present',
      late_minutes: 0,
      early_minutes: 0,
      overtime_minutes: 0,
      note: '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Self check-out: set check_out timestamp on an existing att_record.
 */
export async function selfCheckOut(
  recordId: string
): Promise<import('@/types').AttRecord> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('att_records')
    .update({ check_out: now })
    .eq('id', recordId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Check if employee has an approved remote leave request covering today.
 * Used to bypass geofence on WFH days.
 */
export async function checkRemoteApproved(
  employeeId: string,
  date: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('att_requests')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('request_type', 'leave')
    .eq('leave_type', 'remote')
    .eq('status', 'approved')
    .lte('date_from', date)
    .gte('date_to', date)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
```

- [ ] **Step 5: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in Xs` with 0 TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add types.ts apps/attendance/services/attendanceService.ts
git commit -m "feat(att): add AttOfficeConfig type + geo check-in service functions"
```

---

## Task 3: CheckinWidget Component

**Files:**
- Create: `apps/portal/components/CheckinWidget.tsx`

**Interfaces:**
- Consumes:
  - `fetchOfficeConfig(): Promise<AttOfficeConfig>` (from `attendanceService.ts`)
  - `fetchMyTodayRecord(employeeId: string): Promise<AttRecord | null>`
  - `selfCheckIn(employeeId, lat, lng, method): Promise<AttRecord>`
  - `selfCheckOut(recordId): Promise<AttRecord>`
  - `checkRemoteApproved(employeeId, date): Promise<boolean>`
  - `haversineDistance(lat1, lng1, lat2, lng2): number`
  - `AttRecord`, `AttOfficeConfig` from `@/types`
- Produces:
  - `<CheckinWidget employeeId={string} onToast={(msg, type) => void} />`
  - Calls `onToast('...', 'success' | 'error')` on success/failure

- [ ] **Step 1: Create `CheckinWidget.tsx`**

```tsx
// apps/portal/components/CheckinWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { AttRecord, AttOfficeConfig } from '@/types';
import {
  fetchOfficeConfig,
  fetchMyTodayRecord,
  selfCheckIn,
  selfCheckOut,
  checkRemoteApproved,
  haversineDistance,
} from '@/apps/attendance/services/attendanceService';

interface Props {
  employeeId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type WidgetState =
  | 'loading'
  | 'not_checked_in'
  | 'gps_requesting'
  | 'gps_denied'
  | 'out_of_range'
  | 'checked_in'
  | 'checked_out';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(checkInIso: string, checkOutIso?: string): { hm: string; dayFraction: string } {
  const start = new Date(checkInIso).getTime();
  const end = checkOutIso ? new Date(checkOutIso).getTime() : Date.now();
  const totalMs = Math.max(0, end - start);
  const totalMins = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hours = totalMs / 3_600_000;
  const dayFraction = (hours / 8).toFixed(2);
  return { hm: `${h}h ${m}p`, dayFraction };
}

const CheckinWidget: React.FC<Props> = ({ employeeId, onToast }) => {
  const [state, setState] = useState<WidgetState>('loading');
  const [record, setRecord] = useState<AttRecord | null>(null);
  const [officeConfig, setOfficeConfig] = useState<AttOfficeConfig | null>(null);
  const [outOfRangeDistance, setOutOfRangeDistance] = useState<number>(0);
  const [isRemoteDay, setIsRemoteDay] = useState(false);
  const [liveTimer, setLiveTimer] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load office config + today's record on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      fetchOfficeConfig(),
      fetchMyTodayRecord(employeeId),
      checkRemoteApproved(employeeId, today),
    ]).then(([config, todayRecord, isRemote]) => {
      setOfficeConfig(config);
      setIsRemoteDay(isRemote);
      if (todayRecord) {
        setRecord(todayRecord);
        setState(todayRecord.check_out ? 'checked_out' : 'checked_in');
      } else {
        setState('not_checked_in');
      }
    }).catch(() => setState('not_checked_in'));
  }, [employeeId]);

  // Live timer when checked in but not out
  useEffect(() => {
    if (state === 'checked_in' && record?.check_in) {
      const update = () => {
        const { hm } = formatDuration(record.check_in!);
        setLiveTimer(hm);
      };
      update();
      timerRef.current = setInterval(update, 30000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, record]);

  const handleCheckIn = async () => {
    if (!officeConfig) return;

    // Remote day: bypass geo
    if (isRemoteDay) {
      setState('gps_requesting');
      try {
        const r = await selfCheckIn(employeeId, 0, 0, 'remote');
        setRecord(r);
        setState('checked_in');
        onToast('✅ Đã check in (Remote)', 'success');
      } catch {
        onToast('Lỗi check in. Thử lại sau.', 'error');
        setState('not_checked_in');
      }
      return;
    }

    // Office day: require GPS
    if (!navigator.geolocation) {
      setState('gps_denied');
      return;
    }
    setState('gps_requesting');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          officeConfig.lat,
          officeConfig.lng
        );
        if (dist > officeConfig.radius_meters) {
          setOutOfRangeDistance(Math.round(dist));
          setState('out_of_range');
          return;
        }
        try {
          const r = await selfCheckIn(employeeId, pos.coords.latitude, pos.coords.longitude, 'geo');
          setRecord(r);
          setState('checked_in');
          onToast('✅ Chấm công thành công!', 'success');
        } catch {
          onToast('Lỗi khi lưu check in. Thử lại sau.', 'error');
          setState('not_checked_in');
        }
      },
      () => setState('gps_denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleCheckOut = async () => {
    if (!record) return;
    try {
      const r = await selfCheckOut(record.id);
      setRecord(r);
      setState('checked_out');
      const { hm, dayFraction } = formatDuration(r.check_in!, r.check_out!);
      onToast(`✅ Check out — ${hm} (${dayFraction} ngày công)`, 'success');
    } catch {
      onToast('Lỗi khi lưu check out. Thử lại sau.', 'error');
    }
  };

  const card: React.CSSProperties = {
    background: '#161616',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
  };

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hôm nay
          </p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#ccc', marginTop: '2px' }}>{today}</p>
        </div>
        {isRemoteDay && (
          <span style={{
            fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
            background: 'rgba(6,182,212,0.1)', color: '#06B6D4', textTransform: 'uppercase',
          }}>
            🏠 Remote
          </span>
        )}
      </div>

      {/* States */}
      {state === 'loading' && (
        <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Đang tải...</p>
      )}

      {state === 'not_checked_in' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Bạn chưa chấm công hôm nay</p>
          <button
            onClick={handleCheckIn}
            style={{
              background: '#FF9500', color: '#000', border: 'none', borderRadius: '12px',
              padding: '14px 40px', fontSize: '15px', fontWeight: 900, cursor: 'pointer',
              letterSpacing: '-0.01em', width: '100%', maxWidth: '280px',
            }}
          >
            📍 CHECK IN
          </button>
        </div>
      )}

      {state === 'gps_requesting' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p className="animate-pulse" style={{ color: '#FF9500', fontSize: '13px', fontWeight: 700 }}>
            📡 Đang xác định vị trí...
          </p>
        </div>
      )}

      {state === 'gps_denied' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '12px' }}>
            ⚠️ Vui lòng cho phép quyền vị trí trong trình duyệt
          </p>
          <button
            onClick={() => setState('not_checked_in')}
            style={{
              background: 'transparent', border: '1px solid #444', borderRadius: '8px',
              color: '#ccc', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {state === 'out_of_range' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#FF3B30', fontSize: '13px', marginBottom: '4px' }}>
            📍 Bạn đang cách văn phòng ~{outOfRangeDistance}m
          </p>
          <p style={{ color: '#666', fontSize: '12px', marginBottom: '12px' }}>
            Cần ở trong bán kính {officeConfig?.radius_meters ?? 300}m để chấm công
          </p>
          <button
            onClick={() => setState('not_checked_in')}
            style={{
              background: 'transparent', border: '1px solid #444', borderRadius: '8px',
              color: '#ccc', padding: '8px 20px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {state === 'checked_in' && record?.check_in && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#34C759', boxShadow: '0 0 6px #34C75988', flexShrink: 0,
            }} />
            <div>
              <p style={{ fontSize: '13px', color: '#ccc' }}>
                Vào lúc <strong style={{ color: '#F5F5F5' }}>{formatTime(record.check_in)}</strong>
                {record.method === 'remote' && (
                  <span style={{ color: '#06B6D4', fontSize: '11px', marginLeft: '8px' }}>🏠 Remote</span>
                )}
              </p>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                ⏱ Đang làm: {liveTimer}
              </p>
            </div>
          </div>
          <button
            onClick={handleCheckOut}
            style={{
              background: 'transparent', border: '1px solid #FF9500', borderRadius: '12px',
              color: '#FF9500', padding: '12px 32px', fontSize: '14px', fontWeight: 800,
              cursor: 'pointer', width: '100%', letterSpacing: '-0.01em',
            }}
          >
            🏁 CHECK OUT
          </button>
        </div>
      )}

      {state === 'checked_out' && record?.check_in && record?.check_out && (
        <div style={{
          background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.2)',
          borderRadius: '12px', padding: '16px 20px',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 800, color: '#34C759', marginBottom: '8px' }}>
            ✅ Hoàn thành ngày làm việc
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Vào</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#F5F5F5' }}>{formatTime(record.check_in)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Ra</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#F5F5F5' }}>{formatTime(record.check_out)}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Giờ làm</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#FF9500' }}>
                {formatDuration(record.check_in, record.check_out).hm}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>Ngày công</p>
              <p style={{ fontSize: '16px', fontWeight: 900, color: '#34C759' }}>
                {formatDuration(record.check_in, record.check_out).dayFraction}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinWidget;
```

- [ ] **Step 2: Verify TypeScript build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓"
```
Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/portal/components/CheckinWidget.tsx
git commit -m "feat(portal): add CheckinWidget with geolocation + all UI states"
```

---

## Task 4: Wire Portal + Admin Settings

**Files:**
- Modify: `apps/portal/components/PortalApp.tsx`
- Modify: `apps/attendance/components/ShiftManager.tsx`

**Interfaces:**
- Consumes:
  - `<CheckinWidget employeeId={string} onToast={fn} />` (from Task 3)
  - `fetchMyRecordsByRange(employeeId, from, to): Promise<AttRecord[]>` (from Task 2)
  - `fetchOfficeConfig(): Promise<AttOfficeConfig>` (from Task 2)
  - `updateOfficeConfig(id, updates): Promise<void>` (from Task 2)
  - `AttOfficeConfig`, `AttRecord` from `@/types`
- Produces: working Portal attendance tab with widget + daily history; ShiftManager with office settings section

- [ ] **Step 1: Update the attendance section in `PortalApp.tsx`**

At the top of the file, add imports:

```typescript
import CheckinWidget from './CheckinWidget';
import { fetchMyRecordsByRange } from '@/apps/attendance/services/attendanceService';
import { AttRecord } from '@/types';
```

In the state declarations block (after `const [attendance, setAttendance]`), add:

```typescript
const [dailyRecords, setDailyRecords] = useState<AttRecord[]>([]);
```

Find the attendance `useEffect` (around line 144) and replace it:

```typescript
// Load attendance when tab changes
useEffect(() => {
  if (activeTab === 'attendance' && currentUser.employee_id) {
    setIsLoading(true);
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = now.toISOString().split('T')[0];
    Promise.all([
      fetchMyAttendance(currentUser.employee_id),
      fetchMyRecordsByRange(currentUser.employee_id, from, to),
    ])
      .then(([monthly, daily]) => {
        setAttendance(monthly);
        setDailyRecords(daily);
      })
      .catch(() => { setAttendance([]); setDailyRecords([]); })
      .finally(() => setIsLoading(false));
  }
}, [activeTab, currentUser.employee_id]);
```

Find the `{/* ── Attendance Tab ── */}` section (around line 372) and replace its full content:

```tsx
{/* ── Attendance Tab ── */}
{activeTab === 'attendance' && (
  <div className="animate-fadeInUp">
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
        ⏰ Chấm công của tôi
      </h2>
      <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
        Check in/out hàng ngày và xem lịch sử
      </p>
    </div>

    {!currentUser.employee_id ? (
      <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔗</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Tài khoản chưa liên kết nhân viên</p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>Liên hệ HR để liên kết tài khoản với hồ sơ nhân viên</p>
      </div>
    ) : (
      <>
        {/* Check-in Widget */}
        <CheckinWidget
          employeeId={currentUser.employee_id}
          onToast={(msg, type) => setToast({ message: msg, type })}
        />

        {/* Daily History — this month */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
            📅 Lịch sử tháng này
          </p>
          {isLoading ? (
            <p className="animate-pulse" style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Đang tải...</p>
          ) : dailyRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', background: '#161616', borderRadius: '12px', border: '1px solid #222' }}>
              <p style={{ color: '#666', fontSize: '13px' }}>Chưa có dữ liệu chấm công tháng này</p>
            </div>
          ) : (
            <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 80px 60px',
                padding: '10px 16px', borderBottom: '1px solid #222',
                background: 'rgba(255,255,255,0.02)',
              }}>
                {['Ngày', 'Vào', 'Ra', 'Số giờ', 'Ngày công', 'Loại'].map(h => (
                  <span key={h} style={{ fontSize: '10px', fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>
              {dailyRecords.map((rec) => {
                const checkIn = rec.check_in ? new Date(rec.check_in) : null;
                const checkOut = rec.check_out ? new Date(rec.check_out) : null;
                const totalMs = (checkIn && checkOut) ? checkOut.getTime() - checkIn.getTime() : 0;
                const totalHours = totalMs / 3_600_000;
                const dayFrac = totalHours > 0 ? (totalHours / 8).toFixed(2) : '—';
                const hm = totalMs > 0 ? (() => {
                  const m = Math.floor(totalMs / 60000);
                  return `${Math.floor(m / 60)}h ${m % 60}p`;
                })() : '—';
                const fmtTime = (d: Date | null) => d
                  ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const fmtDate = (s: string) => {
                  const d = new Date(s);
                  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                };
                const methodBadge = rec.method === 'remote'
                  ? { label: 'Remote', color: '#06B6D4' }
                  : { label: 'VP', color: '#34C759' };
                return (
                  <div key={rec.id} style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px 80px 60px',
                    padding: '10px 16px', borderBottom: '1px solid #111', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#ccc' }}>{fmtDate(rec.date)}</span>
                    <span style={{ fontSize: '13px', color: '#F5F5F5' }}>{fmtTime(checkIn)}</span>
                    <span style={{ fontSize: '13px', color: checkOut ? '#F5F5F5' : '#555' }}>
                      {checkOut ? fmtTime(checkOut) : 'Chưa ra'}
                    </span>
                    <span style={{ fontSize: '13px', color: totalMs > 0 ? '#FF9500' : '#555' }}>{hm}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: totalMs > 0 ? '#34C759' : '#555' }}>{dayFrac}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: methodBadge.color }}>{methodBadge.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly summary from HR (existing att_monthly_records) */}
        {attendance.length > 0 && (
          <div>
            <p style={{ fontSize: '12px', fontWeight: 900, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              📊 Bảng công tháng (HR xác nhận)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {attendance.map((att: any) => {
                const sheet = att.sheet || {};
                return (
                  <div key={att.id} style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <p style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>
                        ⏰ Tháng {sheet.month || '?'}/{sheet.year || '?'}
                      </p>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                        background: sheet.status === 'finalized' ? 'rgba(52,199,89,0.1)' : 'rgba(255,149,0,0.1)',
                        color: sheet.status === 'finalized' ? '#34C759' : '#FF9500',
                      }}>
                        {sheet.status === 'finalized' ? '✅ Đã chốt' : '📝 Nháp'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[
                        { label: 'Ngày công', value: att.work_days || 0, color: '#06B6D4' },
                        { label: 'Giờ tăng ca', value: att.ot_hours || 0, color: '#FF9500' },
                        { label: 'Đi muộn', value: att.late_count || 0, color: att.late_count > 0 ? '#FF3B30' : '#888' },
                        { label: 'Nghỉ', value: att.absent_days || 0, color: att.absent_days > 0 ? '#FF3B30' : '#888' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
                          <p style={{ fontSize: '10px', color: '#666', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
                          <p style={{ fontSize: '20px', fontWeight: 900, color }}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {att.note && <p style={{ fontSize: '12px', color: '#888', marginTop: '10px', fontStyle: 'italic' }}>📝 {att.note}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in Xs`.

- [ ] **Step 3: Add office location settings section to `ShiftManager.tsx`**

At the top of `ShiftManager.tsx`, add imports:

```typescript
import { AttOfficeConfig } from '@/types';
import { fetchOfficeConfig, updateOfficeConfig } from '@/apps/attendance/services/attendanceService';
```

Inside the `ShiftManager` component, add state after existing `useState` declarations:

```typescript
const [officeConfig, setOfficeConfig] = useState<AttOfficeConfig | null>(null);
const [officeForm, setOfficeForm] = useState({ office_name: '', lat: '', lng: '', radius_meters: '' });
const [savingOffice, setSavingOffice] = useState(false);

// Load office config on mount
React.useEffect(() => {
  fetchOfficeConfig()
    .then(cfg => {
      setOfficeConfig(cfg);
      setOfficeForm({
        office_name: cfg.office_name,
        lat: String(cfg.lat),
        lng: String(cfg.lng),
        radius_meters: String(cfg.radius_meters),
      });
    })
    .catch(() => {});
}, []);

const handleSaveOffice = async () => {
  if (!officeConfig) return;
  setSavingOffice(true);
  try {
    await updateOfficeConfig(officeConfig.id, {
      office_name: officeForm.office_name,
      lat: parseFloat(officeForm.lat),
      lng: parseFloat(officeForm.lng),
      radius_meters: parseInt(officeForm.radius_meters, 10),
    });
    setOfficeConfig(prev => prev ? {
      ...prev,
      office_name: officeForm.office_name,
      lat: parseFloat(officeForm.lat),
      lng: parseFloat(officeForm.lng),
      radius_meters: parseInt(officeForm.radius_meters, 10),
    } : prev);
  } catch (e) {
    console.error('Failed to save office config', e);
  } finally {
    setSavingOffice(false);
  }
};
```

At the end of the ShiftManager's returned JSX, just before the closing `</div>` of the root element, append:

```tsx
{/* ── Office Location Settings ─────────────────── */}
<div className={cardCls} style={{ marginTop: '24px' }}>
  <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#FF9500', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    📍 Vị trí văn phòng (Geofence)
  </h3>
  <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
    Nhân viên phải ở trong bán kính radius_meters để chấm công qua GPS.
  </p>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
    <div>
      <label className={labelCls}>Tên văn phòng</label>
      <input
        className={inputCls}
        value={officeForm.office_name}
        onChange={e => setOfficeForm(f => ({ ...f, office_name: e.target.value }))}
        placeholder="Hòa Bình Green City"
      />
    </div>
    <div>
      <label className={labelCls}>Bán kính (mét)</label>
      <input
        className={inputCls}
        type="number"
        value={officeForm.radius_meters}
        onChange={e => setOfficeForm(f => ({ ...f, radius_meters: e.target.value }))}
        placeholder="300"
      />
    </div>
    <div>
      <label className={labelCls}>Vĩ độ (Latitude)</label>
      <input
        className={inputCls}
        type="number"
        step="0.0001"
        value={officeForm.lat}
        onChange={e => setOfficeForm(f => ({ ...f, lat: e.target.value }))}
        placeholder="20.9979"
      />
    </div>
    <div>
      <label className={labelCls}>Kinh độ (Longitude)</label>
      <input
        className={inputCls}
        type="number"
        step="0.0001"
        value={officeForm.lng}
        onChange={e => setOfficeForm(f => ({ ...f, lng: e.target.value }))}
        placeholder="105.8672"
      />
    </div>
  </div>
  <p style={{ fontSize: '11px', color: '#555', marginBottom: '12px' }}>
    💡 Mở Google Maps, click vào vị trí VP, copy tọa độ (vd: 20.9979, 105.8672)
  </p>
  <button
    onClick={handleSaveOffice}
    disabled={savingOffice}
    style={{
      background: '#FF9500', color: '#000', border: 'none', borderRadius: '10px',
      padding: '10px 24px', fontSize: '13px', fontWeight: 800, cursor: savingOffice ? 'not-allowed' : 'pointer',
      opacity: savingOffice ? 0.7 : 1,
    }}
  >
    {savingOffice ? 'Đang lưu...' : '💾 Lưu cấu hình'}
  </button>
</div>
```

- [ ] **Step 4: Final build check**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ built in Xs` — 0 errors.

- [ ] **Step 5: Manual test checklist**

Run `npm run dev` and test these flows in browser:

**As member/employee:**
1. Navigate to `#portal` → tab "Chấm công"
2. Widget shows "Bạn chưa chấm công hôm nay" + orange CHECK IN button ✓
3. Click CHECK IN → browser asks GPS permission → if denied → shows "Vui lòng cho phép" ✓
4. If GPS granted + out of range → shows distance message ✓
5. If GPS granted + in range → record created, shows "Vào lúc HH:MM" + timer ✓
6. Click CHECK OUT → shows completed card with hours + ngày công fraction ✓
7. Daily history table shows today's record ✓

**As admin:**
8. Navigate to `#attendance` → tab "Ca làm việc"
9. Scroll to bottom → "📍 Vị trí văn phòng" section appears ✓
10. Edit radius/coords → click Lưu → no error ✓

- [ ] **Step 6: Commit**

```bash
git add apps/portal/components/PortalApp.tsx apps/attendance/components/ShiftManager.tsx
git commit -m "feat(portal): wire CheckinWidget + daily history into attendance tab; admin office settings in ShiftManager"
```

- [ ] **Step 7: Final build + push**

```bash
npm run build && git push
```
Expected: build succeeds, pushed to remote (triggers auto-deploy to VPS).
