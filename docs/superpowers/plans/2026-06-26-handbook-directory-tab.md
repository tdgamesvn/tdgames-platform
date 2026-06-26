# Handbook Directory Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the employee directory (currently "Thông tin công ty" tab in Employee Portal) into HandbookApp as a new "Danh bạ" tab, and remove it from PortalApp.

**Architecture:** HandbookApp gains a second Navbar tab (`activity` key → "👥 Danh bạ") using the same tab-switching pattern as PortalApp. Directory data is fetched lazily on first activation from the existing `portalService`. PortalApp drops the `directory` tab entirely; its default landing tab becomes `payslip`.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind CSS, Supabase

## Global Constraints

- Background: `#0F0F0F`; surface cards: `#161616` / border `#222`
- Cyan accent for directory UI: `#06B6D4` (matches existing Portal directory style)
- No DB migrations required
- `npm run build` must exit 0 with 0 TypeScript errors before commit

---

### Task 1: Add "Danh bạ" tab to HandbookApp

**Files:**
- Modify: `apps/handbook/components/HandbookApp.tsx`

**Interfaces:**
- Consumes: `fetchEmployeeDirectory`, `fetchDepartments` from `@/apps/portal/services/portalService`
- Consumes: `toPublicUrl` from `@/apps/hr/services/hrService`
- Consumes: `HrEmployee`, `HrDepartment` from `@/types`

- [ ] **Step 1: Add three new imports at top of file**

In `apps/handbook/components/HandbookApp.tsx`, after the existing import block, add:

```tsx
import { HrEmployee, HrDepartment } from '@/types';
import { fetchEmployeeDirectory, fetchDepartments } from '@/apps/portal/services/portalService';
import { toPublicUrl } from '@/apps/hr/services/hrService';
```

- [ ] **Step 2: Add local type aliases and HandbookTab type**

Immediately after the new imports (before the `TAB_LABELS` const), add:

```tsx
type DirectoryEmployee = Pick<
  HrEmployee,
  'id' | 'full_name' | 'email' | 'work_email' | 'phone' | 'position' | 'avatar_url' | 'status' | 'type' | 'department_id' | 'date_of_birth' | 'address'
>;
type DepartmentLite = Pick<HrDepartment, 'id' | 'name'>;
type HandbookTab = 'articles' | 'directory';
```

- [ ] **Step 3: Replace TAB_LABELS; add TAB_MAP and REVERSE_TAB**

Replace:
```tsx
const TAB_LABELS: Record<string, string> = {
  history: '📖 Sổ tay',
};
```

With:
```tsx
const TAB_LABELS: Record<string, string> = {
  history:  '📖 Sổ tay',
  activity: '👥 Danh bạ',
};
const TAB_MAP: Record<HandbookTab, string> = {
  articles:  'history',
  directory: 'activity',
};
const REVERSE_TAB: Record<string, HandbookTab> = {
  history:  'articles',
  activity: 'directory',
};
```

- [ ] **Step 4: Add state + helpers inside HandbookApp function**

Inside `HandbookApp`, after the existing `useState` declarations (`categories`, `articles`, `loading`, `selectedCatId`, `selectedArticle`, `search`, `toast`), add:

```tsx
const [activeTab, setActiveTab]       = useState<HandbookTab>('articles');
const [employees, setEmployees]       = useState<DirectoryEmployee[]>([]);
const [departments, setDepartments]   = useState<DepartmentLite[]>([]);
const [dirLoading, setDirLoading]     = useState(false);

const navbarTab = TAB_MAP[activeTab];
const handleNavChange = (tab: string) => {
  const mapped = REVERSE_TAB[tab];
  if (mapped) setActiveTab(mapped);
};
const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
```

- [ ] **Step 5: Add lazy-load useEffect for directory**

After the existing `useEffect` that loads categories/articles, add:

```tsx
// Lazy-load employee directory on first activation
useEffect(() => {
  if (activeTab !== 'directory') return;
  if (employees.length > 0) return; // already loaded
  setDirLoading(true);
  Promise.all([fetchEmployeeDirectory(), fetchDepartments()])
    .then(([emps, deps]) => { setEmployees(emps); setDepartments(deps); })
    .catch((e: any) => setToast({ message: e.message, type: 'error' }))
    .finally(() => setDirLoading(false));
}, [activeTab]);
```

- [ ] **Step 6: Update Navbar props to enable tab switching**

Replace:
```tsx
<Navbar
  theme="dark"
  currentUser={currentUser}
  activeTab="history"
  accessibleTabs={['history']}
  onTabChange={() => {}}
  onLogout={onBack}
  onBack={onBack}
  vcbRate={vcbRate}
  vcbRateLoading={vcbRateLoading}
  appName="Sổ tay"
  tabLabels={TAB_LABELS}
/>
```

With:
```tsx
<Navbar
  theme="dark"
  currentUser={currentUser}
  activeTab={navbarTab}
  accessibleTabs={['history', 'activity']}
  onTabChange={handleNavChange}
  onLogout={onBack}
  onBack={onBack}
  vcbRate={vcbRate}
  vcbRateLoading={vcbRateLoading}
  appName="Sổ tay"
  tabLabels={TAB_LABELS}
/>
```

- [ ] **Step 7: Guard existing articles layout + add directory layout**

In `<main>`, replace the current loading/articles block:

```tsx
{loading ? (
  <div className="flex items-center justify-center py-40 text-neutral-600 text-sm">Đang tải...</div>
) : (
  <div className="flex gap-6">
    {/* ... sidebar + main content ... */}
  </div>
)}
```

With:

```tsx
{/* ── Articles tab ── */}
{activeTab === 'articles' && (
  <>
    {loading ? (
      <div className="flex items-center justify-center py-40 text-neutral-600 text-sm">Đang tải...</div>
    ) : (
      <div className="flex gap-6">
        {/* existing sidebar + main content — no changes inside */}
        {/* ... */}
      </div>
    )}
  </>
)}

{/* ── Directory tab ── */}
{activeTab === 'directory' && (
  <div className="animate-fadeInUp">
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
        👥 Danh bạ nhân viên
      </h2>
      <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>
        Thông tin liên lạc nội bộ — read only
      </p>
    </div>

    {dirLoading ? (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <p className="animate-pulse" style={{ color: '#888', fontSize: '13px' }}>Đang tải...</p>
      </div>
    ) : employees.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '60px', background: '#161616', borderRadius: '16px', border: '1px solid #222' }}>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>👤</p>
        <p style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Chưa có nhân viên nào</p>
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {employees.map(emp => {
          const avatarSrc = emp.avatar_url ? toPublicUrl(emp.avatar_url) : '';
          return (
            <div key={emp.id} style={{
              background: '#161616', border: '1px solid #222', borderRadius: '20px',
              display: 'flex', overflow: 'hidden',
              transition: 'border-color 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D440'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Avatar — full height */}
              <div style={{
                width: '120px', minHeight: '140px', flexShrink: 0,
                background: avatarSrc
                  ? `url(${avatarSrc}) center/cover no-repeat`
                  : 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid #222',
              }}>
                {!avatarSrc && (
                  <span style={{ fontSize: '40px', fontWeight: 900, color: '#fff', opacity: 0.8 }}>
                    {emp.full_name?.[0] || '?'}
                  </span>
                )}
              </div>
              {/* Info */}
              <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#F5F5F5' }}>{emp.full_name}</p>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0,
                    background: emp.status === 'active' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
                    color: emp.status === 'active' ? '#34C759' : '#FF3B30',
                  }}>
                    {emp.type === 'fulltime' ? 'FT' : emp.type === 'parttime' ? 'PT' : 'FL'}
                  </span>
                </div>
                {emp.position && (
                  <p style={{ fontSize: '13px', color: '#06B6D4', fontWeight: 600 }}>{emp.position}</p>
                )}
                {emp.department_id && deptMap[emp.department_id] && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '6px',
                    background: 'rgba(6,182,212,0.08)', color: '#06B6D4', alignSelf: 'flex-start',
                  }}>
                    {deptMap[emp.department_id]}
                  </span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  {emp.work_email && <span style={{ fontSize: '11px', color: '#888' }}>💼 {emp.work_email}</span>}
                  {emp.phone && <span style={{ fontSize: '11px', color: '#888' }}>📱 {emp.phone}</span>}
                  {emp.date_of_birth && (
                    <span style={{ fontSize: '11px', color: '#888' }}>🎂 {new Date(emp.date_of_birth).toLocaleDateString('vi-VN')}</span>
                  )}
                  {emp.address && (
                    <span style={{ fontSize: '11px', color: '#888', lineHeight: '1.3' }}>📍 {emp.address}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}
```

---

### Task 2: Remove "Thông tin công ty" tab from PortalApp

**Files:**
- Modify: `apps/portal/components/PortalApp.tsx`

- [ ] **Step 1: Remove HrEmployee + HrDepartment from types import**

Change:
```tsx
import {
  AccountUser,
  HrEmployee,
  HrDepartment,
  PayPayrollRecord,
  PayPayrollSheet,
  AttMonthlyRecord,
  AttMonthlySheet,
} from '@/types';
```

To:
```tsx
import {
  AccountUser,
  PayPayrollRecord,
  PayPayrollSheet,
  AttMonthlyRecord,
  AttMonthlySheet,
} from '@/types';
```

- [ ] **Step 2: Remove fetchEmployeeDirectory + fetchDepartments from portalService import**

Change:
```tsx
import {
  fetchEmployeeDirectory,
  fetchDepartments,
  fetchMyPayslips,
  fetchMyAttendance,
  fetchMyProfile,
} from '../services/portalService';
```

To:
```tsx
import {
  fetchMyPayslips,
  fetchMyAttendance,
  fetchMyProfile,
} from '../services/portalService';
```

- [ ] **Step 3: Remove DirectoryEmployee + DepartmentLite type aliases**

Remove these two type alias declarations (they appear just after the portalService import):
```tsx
type DirectoryEmployee = Pick<
  HrEmployee,
  'id' | 'full_name' | 'email' | 'work_email' | 'phone' | 'position' | 'avatar_url' | 'status' | 'type' | 'department_id' | 'date_of_birth' | 'address'
>;
type DepartmentLite = Pick<HrDepartment, 'id' | 'name'>;
```

- [ ] **Step 4: Update PortalTab type — remove 'directory'**

Change:
```tsx
type PortalTab = 'directory' | 'payslip' | 'attendance' | 'leave' | 'profile' | 'evaluation' | 'proposals';
```

To:
```tsx
type PortalTab = 'payslip' | 'attendance' | 'leave' | 'profile' | 'evaluation' | 'proposals';
```

- [ ] **Step 5: Update TAB_MAP, TAB_LABELS, REVERSE_TAB — remove directory/history entries**

Change:
```tsx
const TAB_MAP: Record<PortalTab, string> = {
  directory:  'history',
  payslip:    'activity',
  attendance: 'tasks',
  leave:      'recurring',
  profile:    'edit',
  evaluation: 'dashboard',
  proposals:  'proposals',
};
const TAB_LABELS: Record<string, string> = {
  history:   'Thông tin công ty',
  activity:  'Bảng lương',
  tasks:     'Chấm công',
  recurring: 'Nghỉ phép',
  edit:      'Hồ sơ',
  dashboard: 'Đánh giá',
  proposals: 'Đề xuất',
};
const REVERSE_TAB: Record<string, PortalTab> = {
  history:   'directory',
  activity:  'payslip',
  tasks:     'attendance',
  recurring: 'leave',
  edit:      'profile',
  dashboard: 'evaluation',
  proposals: 'proposals',
};
```

To:
```tsx
const TAB_MAP: Record<PortalTab, string> = {
  payslip:    'activity',
  attendance: 'tasks',
  leave:      'recurring',
  profile:    'edit',
  evaluation: 'dashboard',
  proposals:  'proposals',
};
const TAB_LABELS: Record<string, string> = {
  activity:  'Bảng lương',
  tasks:     'Chấm công',
  recurring: 'Nghỉ phép',
  edit:      'Hồ sơ',
  dashboard: 'Đánh giá',
  proposals: 'Đề xuất',
};
const REVERSE_TAB: Record<string, PortalTab> = {
  activity:  'payslip',
  tasks:     'attendance',
  recurring: 'leave',
  edit:      'profile',
  dashboard: 'evaluation',
  proposals: 'proposals',
};
```

- [ ] **Step 6: Change default tab from 'directory' to 'payslip'**

Change:
```tsx
const resolvedInitialTab: PortalTab = initialEvalCycleId
  ? 'evaluation'
  : initialTab === 'proposals'
    ? 'proposals'
    : 'directory';
```

To:
```tsx
const resolvedInitialTab: PortalTab = initialEvalCycleId
  ? 'evaluation'
  : initialTab === 'proposals'
    ? 'proposals'
    : 'payslip';
```

- [ ] **Step 7: Remove employees + departments state declarations**

Remove:
```tsx
const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
const [departments, setDepartments] = useState<DepartmentLite[]>([]);
```

- [ ] **Step 8: Remove the directory data-loading useEffect**

Remove:
```tsx
// Load directory data
useEffect(() => {
  setIsLoading(true);
  Promise.all([fetchEmployeeDirectory(), fetchDepartments()])
    .then(([emps, deps]) => { setEmployees(emps); setDepartments(deps); })
    .catch(err => setToast({ message: err.message, type: 'error' }))
    .finally(() => setIsLoading(false));
}, []);
```

- [ ] **Step 9: Remove deptMap computed value**

Remove:
```tsx
const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
```

- [ ] **Step 10: Remove 'history' from accessibleTabs**

Change:
```tsx
const accessibleTabs = useMemo(() => {
  return ['history', 'activity', 'tasks', 'recurring', 'proposals', 'dashboard', 'edit'];
}, []);
```

To:
```tsx
const accessibleTabs = useMemo(() => {
  return ['activity', 'tasks', 'recurring', 'proposals', 'dashboard', 'edit'];
}, []);
```

- [ ] **Step 11: Remove the entire directory JSX block**

Remove the block:
```tsx
{/* ── Directory Tab ── */}
{activeTab === 'directory' && (
  <div className="animate-fadeInUp">
    ...entire block...
  </div>
)}
```

(This is approximately lines 209–307 in the current file — the block starting with `{activeTab === 'directory' &&` and ending before `{/* ── Payslip Tab ── */}`.)

---

### Task 3: Build check + commit

- [ ] **Step 1: Run TypeScript build**

```bash
npm run build
```

Expected: exits 0, no errors. Module count should be similar to before (±1).

- [ ] **Step 2: Commit both files**

```bash
git add apps/handbook/components/HandbookApp.tsx apps/portal/components/PortalApp.tsx
git commit -m "feat: move employee directory from Portal to Handbook

Danh bạ nhân viên is now accessible via the Handbook app (👥 Danh bạ tab).
Employee Portal default tab changed to Bảng lương.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Push**

```bash
git push
```
