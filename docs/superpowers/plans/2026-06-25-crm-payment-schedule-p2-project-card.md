# CRM Payment Schedule — P2: UI trong ProjectList card

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm section "💳 Lịch thanh toán" vào expanded project card trong `ProjectList.tsx`.

**Architecture:** 2 component mới: `PaymentScheduleForm` (inline form add/edit) và `PaymentScheduleSection` (container section). `ProjectList.tsx` chỉ import và render `PaymentScheduleSection` — không cần biết gì về service hay state bên trong.

**Tech Stack:** React 19, TypeScript, `@/utils/roleUtils`, `crmPaymentScheduleService`

**Prerequisite:** P1 đã hoàn thành (table tồn tại, types.ts có `CrmPaymentSchedule`, service file tồn tại).

## Global Constraints

- Import roleUtils: `import { hasAnyRole } from '@/utils/roleUtils';`
- Import types: `import type { CrmPaymentSchedule, AccountUser } from '@/types';`
- Currency formatter (copy từ ProjectList.tsx): `(n, cur) => cur === 'VND' ? n.toLocaleString('vi-VN') + ' ₫' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })`
- Style: inline styles khớp với ProjectList (dark theme `#0F0F0F`, `#161616`, `#1a1a1a`; border `#2a2a2a`/`#333`)
- Build check: `npm run build` từ root

---

### Task 1: Create PaymentScheduleForm.tsx

**Files:**
- Create: `apps/crm/components/PaymentScheduleForm.tsx`

**Interfaces:**
- Consumes: `CrmPaymentSchedule` from `@/types`
- Produces: component `PaymentScheduleForm` với props:
  ```typescript
  interface Props {
    projectId: string;
    projectCurrency: string;
    schedule?: CrmPaymentSchedule | null; // null/undefined = create mode
    onSave: (data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    onClose: () => void;
  }
  ```

- [ ] **Step 1: Tạo file**

```tsx
// apps/crm/components/PaymentScheduleForm.tsx
import React, { useState } from 'react';
import type { CrmPaymentSchedule } from '@/types';

interface Props {
  projectId: string;
  projectCurrency: string;
  schedule?: CrmPaymentSchedule | null;
  onSave: (data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onClose: () => void;
}

const PaymentScheduleForm: React.FC<Props> = ({
  projectId, projectCurrency, schedule, onSave, onClose,
}) => {
  const [form, setForm] = useState({
    name:     schedule?.name     ?? '',
    amount:   schedule?.amount   ?? 0,
    currency: schedule?.currency ?? projectCurrency ?? 'VND',
    due_date: schedule?.due_date ?? '',
    notes:    schedule?.notes    ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.due_date) return;
    setSaving(true);
    try {
      await onSave({
        project_id:  projectId,
        name:        form.name.trim(),
        amount:      Number(form.amount),
        currency:    form.currency,
        due_date:    form.due_date,
        status:      schedule?.status      ?? 'pending',
        invoiced_at: schedule?.invoiced_at ?? null,
        paid_at:     schedule?.paid_at     ?? null,
        notes:       form.notes.trim() || null,
      });
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', background: '#1a1a1a', border: '1px solid #333',
    borderRadius: '8px', color: '#F5F5F5', padding: '8px 12px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase',
    letterSpacing: '0.08em', display: 'block', marginBottom: '4px',
  };

  return (
    <div style={{
      marginTop: '12px', background: '#141414', border: '1px solid #333',
      borderRadius: '10px', padding: '16px',
    }}>
      <h5 style={{
        fontSize: '11px', fontWeight: 800, color: '#FF9500',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
      }}>
        {schedule ? '✏️ Sửa đợt thanh toán' : '+ Thêm đợt thanh toán'}
      </h5>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <label style={lbl}>Tên đợt *</label>
          <input
            style={inp}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="VD: Đặt cọc 30%, Nghiệm thu..."
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
          <div>
            <label style={lbl}>Số tiền *</label>
            <input
              style={inp}
              type="number"
              min="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              required
            />
          </div>
          <div>
            <label style={lbl}>Tiền tệ</label>
            <select
              style={inp}
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div>
          <label style={lbl}>Ngày đến hạn *</label>
          <input
            style={inp}
            type="date"
            value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            required
          />
        </div>

        <div>
          <label style={lbl}>Ghi chú</label>
          <input
            style={inp}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Tuỳ chọn..."
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 transition-all"
            style={{ background: '#FF9500' }}
          >
            {saving ? 'Đang lưu...' : schedule ? 'Lưu thay đổi' : 'Thêm đợt'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentScheduleForm;
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: thành công (file chưa được import ở đâu).

- [ ] **Step 3: Commit**

```bash
git add apps/crm/components/PaymentScheduleForm.tsx
git commit -m "feat(crm): add PaymentScheduleForm component"
```

---

### Task 2: Create PaymentScheduleSection.tsx

**Files:**
- Create: `apps/crm/components/PaymentScheduleSection.tsx`

**Interfaces:**
- Consumes:
  - `fetchPaymentSchedulesByProject`, `createPaymentSchedule`, `updatePaymentSchedule`, `markPaymentScheduleInvoiced`, `markPaymentSchedulePaid`, `deletePaymentSchedule` from `../services/crmPaymentScheduleService`
  - `PaymentScheduleForm` from `./PaymentScheduleForm`
  - `hasAnyRole` from `@/utils/roleUtils`
- Produces: component `PaymentScheduleSection` với props:
  ```typescript
  interface Props {
    projectId: string;
    projectCurrency: string;
    currentUser: AccountUser | null;
  }
  ```

- [ ] **Step 1: Tạo file**

```tsx
// apps/crm/components/PaymentScheduleSection.tsx
import React, { useState, useEffect, useRef } from 'react';
import type { CrmPaymentSchedule, AccountUser } from '@/types';
import { hasAnyRole } from '@/utils/roleUtils';
import {
  fetchPaymentSchedulesByProject,
  createPaymentSchedule,
  updatePaymentSchedule,
  markPaymentScheduleInvoiced,
  markPaymentSchedulePaid,
  deletePaymentSchedule,
} from '../services/crmPaymentScheduleService';
import PaymentScheduleForm from './PaymentScheduleForm';

interface Props {
  projectId: string;
  projectCurrency: string;
  currentUser: AccountUser | null;
}

// Trả về style theo status + overdue
function getStatus(s: CrmPaymentSchedule) {
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

const PaymentScheduleSection: React.FC<Props> = ({ projectId, projectCurrency, currentUser }) => {
  const [schedules, setSchedules]         = useState<CrmPaymentSchedule[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [editingSchedule, setEditing]     = useState<CrmPaymentSchedule | null>(null);
  const [actionOpenId, setActionOpenId]   = useState<string | null>(null);
  const [deleteConfirmId, setDeleteId]    = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  const canManage    = hasAnyRole(currentUser, ['admin', 'bd']);
  const canMarkStatus = hasAnyRole(currentUser, ['admin', 'ke_toan']);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    if (!actionOpenId) return;
    const handleClick = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [actionOpenId]);

  const load = async () => {
    setLoading(true);
    try {
      setSchedules(await fetchPaymentSchedulesByProject(projectId));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const currency   = schedules[0]?.currency || projectCurrency || 'VND';
  const totalAmt   = schedules.reduce((s, r) => s + r.amount, 0);
  const totalPaid  = schedules.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalLeft  = totalAmt - totalPaid;

  const handleSave = async (data: Omit<CrmPaymentSchedule, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingSchedule) {
      await updatePaymentSchedule(editingSchedule.id, {
        name: data.name, amount: data.amount,
        currency: data.currency, due_date: data.due_date, notes: data.notes,
      });
    } else {
      await createPaymentSchedule({ ...data, project_id: projectId });
    }
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (id: string) => {
    await deletePaymentSchedule(id);
    setDeleteId(null);
    await load();
  };

  return (
    <div style={{
      marginBottom: '20px', background: '#0F0F0F',
      border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{
          fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#888', margin: 0,
        }}>
          💳 Lịch thanh toán
          {schedules.length > 0 && (
            <span style={{ color: '#555', marginLeft: '6px' }}>· {schedules.length} đợt</span>
          )}
        </h4>
        {canManage && (
          <button
            type="button"
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            + Thêm đợt
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <p style={{ color: '#555', fontSize: '12px' }}>Đang tải...</p>
      ) : schedules.length === 0 ? (
        <p style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>
          Chưa có đợt thanh toán nào.
        </p>
      ) : (
        <>
          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {schedules.map(s => {
              const st = getStatus(s);
              const isOverdue = s.status === 'pending' && s.due_date < new Date().toISOString().slice(0, 10);
              const isActionOpen = actionOpenId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: isOverdue ? 'rgba(255,69,58,0.06)' : '#161616',
                    border: `1px solid ${isOverdue ? 'rgba(255,69,58,0.2)' : '#222'}`,
                  }}
                >
                  {/* Name */}
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: '#E5E5E5', minWidth: 0 }}>
                    {s.name}
                  </span>

                  {/* Amount */}
                  <span style={{ fontSize: '13px', fontWeight: 900, color: '#F5F5F5', whiteSpace: 'nowrap' }}>
                    {fmt(s.amount, s.currency)}
                  </span>

                  {/* Due date */}
                  <span style={{ fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>
                    {s.due_date}
                  </span>

                  {/* Status badge */}
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                    color: st.color, background: st.bg, whiteSpace: 'nowrap',
                  }}>
                    {st.icon} {st.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} ref={isActionOpen ? actionRef : undefined}>
                    {/* Edit — chỉ BD + admin, chỉ khi pending */}
                    {canManage && s.status === 'pending' && deleteConfirmId !== s.id && (
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => { setEditing(s); setShowForm(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '12px', color: '#555' }}
                      >✏️</button>
                    )}

                    {/* Mark status — admin + ke_toan, chỉ khi chưa paid */}
                    {canMarkStatus && s.status !== 'paid' && deleteConfirmId !== s.id && (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setActionOpenId(isActionOpen ? null : s.id)}
                          className="px-2 py-1 rounded text-[10px] font-black text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
                        >
                          ▾
                        </button>
                        {isActionOpen && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px',
                            zIndex: 50, minWidth: '200px', overflow: 'hidden',
                          }}>
                            {s.status === 'pending' && (
                              <button
                                type="button"
                                onClick={async () => { await markPaymentScheduleInvoiced(s.id); setActionOpenId(null); await load(); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#0A84FF', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                🔵 Đánh dấu đã xuất invoice
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => { await markPaymentSchedulePaid(s.id); setActionOpenId(null); await load(); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#34C759', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              🟢 Đánh dấu đã thu tiền
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Delete — chỉ BD + admin */}
                    {canManage && (
                      deleteConfirmId === s.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#FF453A', fontWeight: 700 }}>Xoá?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            style={{ fontSize: '10px', padding: '2px 8px', background: '#FF453A', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                          >✓</button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            style={{ fontSize: '10px', padding: '2px 8px', background: '#333', border: 'none', borderRadius: '4px', color: '#ccc', cursor: 'pointer', fontWeight: 700 }}
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          title="Xoá"
                          onClick={() => setDeleteId(s.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '12px', color: '#555' }}
                        >🗑️</button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div style={{
            borderTop: '1px solid #222', paddingTop: '10px',
            display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap',
          }}>
            <span style={{ color: '#888' }}>
              Tổng: <strong style={{ color: '#F5F5F5' }}>{fmt(totalAmt, currency)}</strong>
            </span>
            <span style={{ color: '#888' }}>
              Thu: <strong style={{ color: '#34C759' }}>{fmt(totalPaid, currency)}</strong>
            </span>
            <span style={{ color: '#888' }}>
              Còn: <strong style={{ color: totalLeft > 0 ? '#FF9500' : '#555' }}>{fmt(totalLeft, currency)}</strong>
            </span>
          </div>
        </>
      )}

      {/* Inline form */}
      {showForm && (
        <PaymentScheduleForm
          projectId={projectId}
          projectCurrency={projectCurrency}
          schedule={editingSchedule}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

export default PaymentScheduleSection;
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: thành công.

- [ ] **Step 3: Commit**

```bash
git add apps/crm/components/PaymentScheduleSection.tsx apps/crm/components/PaymentScheduleForm.tsx
git commit -m "feat(crm): add PaymentScheduleSection + PaymentScheduleForm components"
```

---

### Task 3: Wire vào ProjectList.tsx

**Files:**
- Modify: `apps/crm/components/ProjectList.tsx`

**Interfaces:**
- Consumes: `PaymentScheduleSection` từ `./PaymentScheduleSection`
- Change: thêm `<PaymentScheduleSection>` vào expanded card, ngay SAU `{/* ── Billing Progress Panel ── */}` block

- [ ] **Step 1: Thêm import**

Mở `apps/crm/components/ProjectList.tsx`. Tìm dòng import đầu file. Thêm:

```typescript
import PaymentScheduleSection from './PaymentScheduleSection';
```

(Thêm sau các import hiện có trong file)

- [ ] **Step 2: Thêm component vào expanded card**

Tìm comment `{/* Expanded detail */}` (khoảng line 401) trong file. Bên trong block đó, tìm cuối phần billing panel (sau closing `</div>` của billing block). Thêm `<PaymentScheduleSection>` ngay sau:

```tsx
{/* ── Payment Schedule Section ── */}
<PaymentScheduleSection
  projectId={proj.id}
  projectCurrency={proj.currency || 'VND'}
  currentUser={currentUser ?? null}
/>
```

Vị trí chèn: ngay sau closing `})()}` của IIFE billing panel, trước phần files/tabs tiếp theo trong expanded block.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: thành công, không có TypeScript errors.

- [ ] **Step 4: Smoke test thủ công**

1. Chạy `npm run dev`
2. Vào CRM → Projects
3. Mở rộng (expand) một project card
4. Kiểm tra section "💳 Lịch thanh toán" xuất hiện bên dưới Billing Progress panel
5. Thêm một đợt thanh toán → confirm hiển thị đúng
6. Admin/ke_toan: kiểm tra dropdown "▾" xuất hiện → mark invoiced/paid hoạt động
7. BD: kiểm tra không có dropdown "▾"

- [ ] **Step 5: Commit**

```bash
git add apps/crm/components/ProjectList.tsx
git commit -m "feat(crm): wire PaymentScheduleSection into expanded project card"
```

---

**P2 complete.** Tiếp tục với `2026-06-25-crm-payment-schedule-p3-tracker.md`.
