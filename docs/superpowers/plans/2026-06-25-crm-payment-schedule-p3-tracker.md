# CRM Payment Schedule — P3: PaymentTracker sub-tab "Lịch TT"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm sub-tab "Lịch TT" vào `PaymentTracker.tsx`, hiển thị tất cả đợt thanh toán gom nhóm theo trạng thái (quá hạn / sắp đến / đã xuất invoice).

**Architecture:** Component mới `PaymentScheduleTracker` xử lý toàn bộ state và UI của sub-tab. `PaymentTracker` chỉ thêm toggle và render component mới — code cũ không bị ảnh hưởng. `CrmApp.tsx` cần pass `currentUser` xuống `PaymentTracker`.

**Tech Stack:** React 19, TypeScript, `crmPaymentScheduleService`, `@/utils/roleUtils`

**Prerequisite:** P1 hoàn thành.

## Global Constraints

- Import: `import { hasAnyRole } from '@/utils/roleUtils';`
- Import: `import type { AccountUser, CrmClient } from '@/types';`
- Import service: `import { fetchAllPaymentSchedules, markPaymentScheduleInvoiced, markPaymentSchedulePaid, type PaymentScheduleWithProject } from '../services/crmPaymentScheduleService';`
- Style: khớp màu `PaymentTracker.tsx` hiện tại (`#0F0F0F` bg, `#FF453A` overdue, `#FF9500` pending, `#0A84FF` invoiced, `#34C759` paid)
- Build check: `npm run build` sau mỗi task

---

### Task 1: Create PaymentScheduleTracker.tsx

**Files:**
- Create: `apps/crm/components/PaymentScheduleTracker.tsx`

**Interfaces:**
- Consumes:
  - `fetchAllPaymentSchedules`, `markPaymentScheduleInvoiced`, `markPaymentSchedulePaid`, `PaymentScheduleWithProject` from `../services/crmPaymentScheduleService`
  - `hasAnyRole` from `@/utils/roleUtils`
- Produces: component `PaymentScheduleTracker` với props:
  ```typescript
  interface Props {
    clients: CrmClient[];
    currentUser: AccountUser | null;
  }
  ```

- [ ] **Step 1: Tạo file**

```tsx
// apps/crm/components/PaymentScheduleTracker.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CrmClient, AccountUser } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import {
  fetchAllPaymentSchedules,
  markPaymentScheduleInvoiced,
  markPaymentSchedulePaid,
  type PaymentScheduleWithProject,
} from '../services/crmPaymentScheduleService';

interface Props {
  clients: CrmClient[];
  currentUser: AccountUser | null;
}

function getStatus(s: PaymentScheduleWithProject) {
  if (s.status === 'paid')
    return { label: 'Đã thu tiền',     icon: '🟢', color: '#34C759', bg: 'rgba(52,199,89,0.12)' };
  if (s.status === 'invoiced')
    return { label: 'Đã xuất invoice', icon: '🔵', color: '#0A84FF', bg: 'rgba(10,132,255,0.12)' };
  const today = new Date().toISOString().slice(0, 10);
  if (s.due_date < today)
    return { label: 'Quá hạn',         icon: '🔴', color: '#FF453A', bg: 'rgba(255,69,58,0.12)' };
  return   { label: 'Chờ xuất',        icon: '🟡', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' };
}

const fmt = (n: number, cur: string) =>
  cur === 'VND'
    ? n.toLocaleString('vi-VN') + ' ₫'
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const sel: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
  color: '#E5E5E5', padding: '8px 12px', fontSize: '12px', outline: 'none',
};

const PaymentScheduleTracker: React.FC<Props> = ({ clients, currentUser }) => {
  const [schedules, setSchedules]       = useState<PaymentScheduleWithProject[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterMonth, setFilterMonth]   = useState('');
  const [actionOpenId, setActionOpenId] = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const canMarkStatus = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    if (!actionOpenId) return;
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionOpenId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPaymentSchedules({
        status:   filterStatus !== 'all' ? filterStatus : undefined,
        month:    filterMonth   || undefined,
        clientId: filterClientId || undefined,
      });
      setSchedules(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus, filterMonth, filterClientId]);

  const today     = new Date().toISOString().slice(0, 10);

  // Tháng tiếp theo (YYYY-MM) dùng cho nhóm "sắp đến hạn"
  const nextMonthStr = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 7);
  })();

  // Nhãn "Tháng X" hiển thị trong header nhóm
  const upcomingLabel = filterMonth
    ? new Date(filterMonth + '-02').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
    : new Date(nextMonthStr + '-02').toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const activeMonth = filterMonth || nextMonthStr;

  const overdue  = schedules.filter(s => s.status === 'pending' && s.due_date < today);
  const upcoming = schedules.filter(s => s.status === 'pending' && s.due_date >= today && s.due_date.startsWith(activeMonth));
  const invoiced = schedules.filter(s => s.status === 'invoiced');

  const handleMarkInvoiced = async (id: string) => {
    await markPaymentScheduleInvoiced(id);
    setActionOpenId(null);
    await load();
  };

  const handleMarkPaid = async (id: string) => {
    await markPaymentSchedulePaid(id);
    setActionOpenId(null);
    await load();
  };

  const renderRow = (s: PaymentScheduleWithProject) => {
    const isActionOpen = actionOpenId === s.id;
    return (
      <div
        key={s.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '10px 16px', borderBottom: '1px solid #1a1a1a',
        }}
      >
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#E5E5E5', margin: 0 }}>
            {s.project_name} – {s.name}
          </p>
          <p style={{ fontSize: '11px', color: '#666', margin: '2px 0 0' }}>{s.client_name}</p>
        </div>

        {/* Amount */}
        <span style={{ fontSize: '13px', fontWeight: 900, color: '#F5F5F5', whiteSpace: 'nowrap' }}>
          {fmt(s.amount, s.currency)}
        </span>

        {/* Due date */}
        <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>
          Hạn: {s.due_date}
        </span>

        {/* Action dropdown — chỉ admin + ke_toan */}
        {canMarkStatus && s.status !== 'paid' && (
          <div style={{ position: 'relative' }} ref={isActionOpen ? actionRef : undefined}>
            <button
              type="button"
              onClick={() => setActionOpenId(isActionOpen ? null : s.id)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
            >
              Action ▾
            </button>
            {isActionOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                zIndex: 50, minWidth: '210px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                {s.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleMarkInvoiced(s.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', fontSize: '12px', fontWeight: 700,
                      color: '#0A84FF', background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    🔵 Đánh dấu đã xuất invoice
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleMarkPaid(s.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', fontSize: '12px', fontWeight: 700,
                    color: '#34C759', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  🟢 Đánh dấu đã thu tiền
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (
    icon: string,
    title: string,
    items: PaymentScheduleWithProject[],
    color: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <div style={{
        marginBottom: '16px', background: '#111',
        border: `1px solid ${color}30`, borderRadius: '12px', overflow: 'hidden',
      }}>
        <div style={{ padding: '10px 16px', background: `${color}10`, borderBottom: `1px solid ${color}20` }}>
          <span style={{
            fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', color,
          }}>
            {icon} {title} ({items.length})
          </span>
        </div>
        <div>{items.map(renderRow)}</div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
          <option value="all">Tất cả trạng thái</option>
          <option value="overdue">🔴 Quá hạn</option>
          <option value="pending">🟡 Chờ xuất</option>
          <option value="invoiced">🔵 Đã xuất invoice</option>
          <option value="paid">🟢 Đã thu</option>
        </select>

        <select value={filterClientId} onChange={e => setFilterClientId(e.target.value)} style={sel}>
          <option value="">Tất cả khách hàng</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={sel}
        />

        {filterMonth && (
          <button
            type="button"
            onClick={() => setFilterMonth('')}
            style={{ fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Xoá filter tháng
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: '#555', fontSize: '13px' }}>Đang tải...</p>
      ) : (
        <>
          {renderGroup('🔴', 'QUÁ HẠN', overdue, '#FF453A')}
          {renderGroup('🟡', `SẮP ĐẾN HẠN – ${upcomingLabel}`, upcoming, '#FF9500')}
          {renderGroup('🔵', 'ĐÃ XUẤT INVOICE – chờ thu', invoiced, '#0A84FF')}

          {overdue.length === 0 && upcoming.length === 0 && invoiced.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ color: '#555', fontSize: '13px', fontStyle: 'italic' }}>
                Không có dữ liệu phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentScheduleTracker;
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add apps/crm/components/PaymentScheduleTracker.tsx
git commit -m "feat(crm): add PaymentScheduleTracker component"
```

---

### Task 2: Wire vào PaymentTracker.tsx + CrmApp.tsx

**Files:**
- Modify: `apps/crm/components/PaymentTracker.tsx`
- Modify: `apps/crm/components/CrmApp.tsx`

**Interfaces:**
- `PaymentTracker` nhận thêm prop: `currentUser?: AccountUser | null`
- `CrmApp` pass `currentUser={currentUser}` xuống `<PaymentTracker>`

- [ ] **Step 1: Cập nhật PaymentTracker.tsx — thêm import + props + sub-tabs**

Mở `apps/crm/components/PaymentTracker.tsx`.

**Thêm import** (sau các import hiện có ở đầu file):
```typescript
import type { AccountUser } from '@/types';
import PaymentScheduleTracker from './PaymentScheduleTracker';
```

**Thay Props interface:**

Tìm:
```typescript
interface Props {
  clients: CrmClient[];
}
```

Thay bằng:
```typescript
interface Props {
  clients: CrmClient[];
  currentUser?: AccountUser | null;
}
```

**Thêm state sub-tab** vào bên trong component (sau khai báo state hiện tại):

Tìm dòng đầu tiên `const [selectedClient` trong component. Thêm ngay trước nó:
```typescript
const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'schedule'>('invoices');
```

**Thêm sub-tab toggle** vào JSX — tìm `<div className="animate-fadeInUp">` (dòng đầu return), thêm ngay sau thẻ `<div>` đó và trước `<div style={{ marginBottom: '28px' }}>`:

```tsx
{/* Sub-tab toggle */}
<div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: '#111', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
  {([
    { key: 'invoices', label: 'Tất cả invoices' },
    { key: 'schedule', label: '💳 Lịch TT' },
  ] as const).map(tab => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setActiveSubTab(tab.key)}
      style={{
        padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        background: activeSubTab === tab.key ? '#FF9500' : 'transparent',
        color:      activeSubTab === tab.key ? '#fff'    : '#888',
      }}
    >
      {tab.label}
    </button>
  ))}
</div>
```

**Wrap nội dung cũ** bằng conditional render — tìm `<div style={{ marginBottom: '28px' }}>` (header "Thanh toán"), bọc toàn bộ phần còn lại của return trong:

```tsx
{activeSubTab === 'invoices' ? (
  <>
    {/* ... toàn bộ JSX cũ của PaymentTracker từ header "Thanh toán" đến cuối ... */}
  </>
) : (
  <PaymentScheduleTracker clients={clients} currentUser={currentUser ?? null} />
)}
```

- [ ] **Step 2: Cập nhật CrmApp.tsx — pass currentUser xuống PaymentTracker**

Mở `apps/crm/components/CrmApp.tsx`. Tìm dòng (khoảng line 272):
```tsx
<PaymentTracker clients={state.clients} />
```

Thay bằng:
```tsx
<PaymentTracker clients={state.clients} currentUser={currentUser} />
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: thành công, không có TypeScript errors.

- [ ] **Step 4: Smoke test thủ công**

1. Chạy `npm run dev`
2. Vào CRM → tab "Thanh toán" (PaymentTracker)
3. Kiểm tra 2 sub-tab xuất hiện: **[Tất cả invoices]** và **[💳 Lịch TT]**
4. Click "Lịch TT":
   - Hiện đúng 3 nhóm (Quá hạn / Sắp đến hạn / Đã xuất invoice)
   - Filter trạng thái / khách hàng / tháng hoạt động
   - Admin/ke_toan thấy nút [Action ▾] → dropdown mark invoiced/paid
   - BD không thấy nút Action

- [ ] **Step 5: Commit**

```bash
git add apps/crm/components/PaymentTracker.tsx apps/crm/components/CrmApp.tsx
git commit -m "feat(crm): add 'Lịch TT' sub-tab to PaymentTracker with PaymentScheduleTracker"
```

---

**P3 complete. Toàn bộ feature CRM Payment Schedule đã được plan:**

| Plan | Nội dung | File |
|------|----------|------|
| P1 | DB + Types + Service | `p1-foundation.md` |
| P2 | Section trong project card | `p2-project-card.md` |
| P3 | Sub-tab trong PaymentTracker | `p3-tracker.md` (file này) |

**Execution options:**

**1. Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans skill

Bắt đầu từ P1 → P2 → P3 theo thứ tự.
