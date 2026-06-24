# CRM Style Guide v1.2 Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply TD Games Platform Style Guide v1.2 tokens consistently across all 8 CRM component files — visual only, zero logic changes.

**Architecture:** Sequential file-by-file edits. Each task modifies exactly one file: replaces inline-style card containers, form inputs, labels, headings, and buttons with approved Tailwind + inline-style patterns from the style guide. No props, state, or service layer is touched.

**Tech Stack:** React 19, TypeScript, Tailwind (via CDN with custom tokens in index.html), Vite

## Global Constraints

- **No logic changes** — state, props, hooks, service calls, event handlers stay identical
- **No new features** — purely style token replacement
- **No `max-w-*`** inside tab components — parent shell handles `max-w-[1400px]`
- **No `hover:scale-105` or `hover:translateY`** — dashboard pattern only
- **`rounded-[20px]`** not `rounded-2xl` for all cards
- **`border-primary/10`** not `border-white/8` for card borders
- **`bg-surface`** (`#1A1A1A`) not `#161616` for card backgrounds
- After every file: run `npm run build` — must pass with zero TypeScript errors
- Commit after each file passes build

---

## Shared Pattern Reference (applies to all 8 files)

### P1 — Card containers
```jsx
// BEFORE
style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px' }}
// AFTER
className="rounded-[20px] border border-primary/10 bg-surface"

// BEFORE — primary-tinted card
style={{ background: 'rgba(255,149,0,0.03)', borderColor: '#333' }}
// AFTER
className="rounded-[20px] border p-5"
style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}
```

### P2 — Form inputs & labels
```jsx
// BEFORE — inputStyle object applied inline
style={{ width: '100%', padding: '10px 14px', background: '#1A1A1A',
  border: '1px solid #333', borderRadius: '8px', color: '#F5F5F5',
  fontSize: '13px', outline: 'none' }}
// AFTER
className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
style={{ background: '#1a1a1a' }}

// BEFORE — labelStyle
style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: '#888' }}
// AFTER
className="text-neutral-500 text-[10px] font-black uppercase tracking-wider"
```

### P3 — Section headings
```jsx
// BEFORE
<h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500',
             textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
// AFTER
<h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
    style={{ color: '#FF9500' }}>
```

### P4 — Buttons
```jsx
// XS — inline action (Xem, Sửa, Xoá icon, filter tabs)
className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"

// SM Primary (Thêm, Lưu, Save)
className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
style={{ background: '#FF9500' }}

// SM Ghost (Huỷ)
className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
```

### P5 — Empty states
```jsx
// BEFORE: ad-hoc inline
// AFTER
<div className="text-center py-16 text-neutral-700 text-sm">
  <p className="text-3xl mb-3">📭</p>
  <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
  <p className="text-xs mt-1 text-neutral-700">...</p>
</div>
```

---

## Task 1 — `CrmApp.tsx` (GlobalActivityFeed)

**Files:**
- Modify: `apps/crm/components/CrmApp.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Only the `GlobalActivityFeed` sub-component (lines ~67–~140) is touched; the rest of `CrmApp` is untouched

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/CrmApp.tsx`. Identify the `GlobalActivityFeed` function component starting around line 67. You will edit only that component — the outer `CrmApp` component, tab routing, and everything else is untouched.

- [ ] **Step 2: Apply heading change (P3)**

  Find the `<h2>` for "Nhật ký hoạt động" (or equivalent heading inside `GlobalActivityFeed`). It will look like:
  ```jsx
  <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', ... }}>
  ```
  Replace with:
  ```jsx
  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
      style={{ color: '#FF9500' }}>
  ```

- [ ] **Step 3: Apply filter buttons (P4 — XS)**

  The 5 filter buttons (Tất cả, Gọi điện, Email, Meeting, Ghi chú) use ad-hoc inline styles. Replace each with XS button class. Active filter (`filterType === value`) uses the per-type color; inactive uses neutral ghost:
  ```jsx
  // Inactive (filterType !== value):
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"

  // Active (filterType === value OR filterType === '' for "Tất cả"):
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all"
  style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500', borderColor: 'rgba(255,149,0,0.3)' }}
  ```

- [ ] **Step 4: Apply activity row cards (P1)**

  Each activity row rendered in the list has `background: '#161616'`, `border: '1px solid #222'`, `borderRadius: '12px'`. Replace with:
  ```jsx
  className="flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface"
  ```
  Remove the inline `style` for background/border/borderRadius from those row divs (keep any other inline styles that are logic-driven, e.g. `color` from `TYPE_ICON`).

- [ ] **Step 5: Fix icon container borderRadius**

  The icon container inside each row has `borderRadius: '12px'`. Change to:
  ```jsx
  className="rounded-xl w-10 h-10 flex items-center justify-center text-xl flex-shrink-0"
  style={{ background: 'rgba(255,255,255,0.05)' }}
  ```

- [ ] **Step 6: Apply empty state (P5)**

  Find any "no activities" empty state inside `GlobalActivityFeed`. Replace with:
  ```jsx
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">📭</p>
    <p className="text-neutral-600 text-sm">Chưa có hoạt động</p>
    <p className="text-xs mt-1 text-neutral-700">Hoạt động sẽ xuất hiện sau khi được ghi nhận</p>
  </div>
  ```

- [ ] **Step 7: Apply loading state**

  Any "Đang tải..." / loading text inside `GlobalActivityFeed` — add `animate-td-pulse`:
  ```jsx
  <p className="text-neutral-500 text-sm animate-td-pulse">Đang tải hoạt động...</p>
  ```

- [ ] **Step 8: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0, zero TypeScript errors.

- [ ] **Step 9: Commit**
  ```bash
  git add apps/crm/components/CrmApp.tsx
  git commit -m "style(crm): apply v1.2 style guide to GlobalActivityFeed"
  ```

---

## Task 2 — `ClientList.tsx`

**Files:**
- Modify: `apps/crm/components/ClientList.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `STATUS_CONFIG` colors, `canDelete` logic, `deleteConfirm` state, all prop wiring

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/ClientList.tsx`. Note the `selectStyle` const (lines ~42-45) and the heading at lines ~52-56.

- [ ] **Step 2: Apply heading change (P3)**

  ```jsx
  // BEFORE
  <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
    Khách hàng
  </h2>
  // AFTER
  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
      style={{ color: '#FF9500' }}>
    Khách hàng
  </h2>
  ```

- [ ] **Step 3: Remove `selectStyle` const and replace usages**

  Delete the `selectStyle` variable. Find every `style={selectStyle}` on `<input>` and `<select>` elements and replace with:
  ```jsx
  // On <input> (search)
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}

  // On <select>
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors"
  style={{ background: '#1a1a1a' }}
  ```

- [ ] **Step 4: Apply stats cards (P1)**

  The stats grid renders each card with `style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px' }}`. Replace with:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4"
  ```
  Keep per-status `onMouseEnter`/`onMouseLeave` hover color logic as-is (or optionally drop hover entirely since the card now uses Tailwind hover; preserve the `onClick` handler and cursor-pointer). If keeping the hover JS, wrap `style` as a dynamic object only for `borderColor`:
  ```jsx
  className="rounded-[20px] border bg-surface p-4 cursor-pointer transition-all"
  style={{ borderColor: isHovered ? cfg.color : 'rgba(255,149,0,0.1)' }}
  ```
  Simpler option (spec-compliant): remove onMouseEnter/Leave, use:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4 cursor-pointer hover:border-primary/30 transition-all"
  ```
  **Choice:** use the simpler Tailwind hover (spec says no JS hover unless logic-driven).

  Stats card label text: `text-[10px] font-black uppercase tracking-wider text-neutral-600`
  Stats card value: `text-2xl font-black` (color: `#FF9500` for "Tổng", cfg.color for status cards)

- [ ] **Step 5: Apply client row cards (P1)**

  Each client row div has `style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px' }}`. Replace with:
  ```jsx
  className="flex items-center gap-4 p-4 rounded-[20px] border border-primary/10 hover:border-primary/20 transition-all bg-surface"
  ```

- [ ] **Step 6: Apply inline action buttons (P4 — XS)**

  Buttons inside client rows (Sửa icon, Xoá icon, Xác nhận, Huỷ):
  ```jsx
  // Sửa / Xoá (XS ghost)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"

  // Xác nhận (confirm delete — danger XS)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"

  // Huỷ (XS ghost)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
  ```

- [ ] **Step 7: Apply empty state (P5)**

  ```jsx
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">👥</p>
    <p className="text-neutral-600 text-sm">Chưa có khách hàng nào</p>
    <p className="text-xs mt-1 text-neutral-700">Nhấn "Thêm khách hàng" để bắt đầu</p>
  </div>
  ```

- [ ] **Step 8: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0, zero TypeScript errors.

- [ ] **Step 9: Commit**
  ```bash
  git add apps/crm/components/ClientList.tsx
  git commit -m "style(crm): apply v1.2 style guide to ClientList"
  ```

---

## Task 3 — `ClientForm.tsx`

**Files:**
- Modify: `apps/crm/components/ClientForm.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: form state, validation, `onSave`/`onUpdate`/`onCancel` wiring, contact management logic, `INDUSTRIES` array

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/ClientForm.tsx`. Scan for any `inputStyle`/`labelStyle` consts (may or may not be defined — check carefully), any `background: '#161616'` / `border: '1px solid #222'` inline styles, and all `<input>`, `<select>`, `<textarea>` elements.

- [ ] **Step 2: Apply form inputs (P2)**

  Every `<input>` in the form that uses legacy inline styles:
  ```jsx
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}
  ```

  Every `<select>`:
  ```jsx
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}
  ```

  Every `<textarea>`:
  ```jsx
  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
  style={{ background: '#1a1a1a' }}
  ```

- [ ] **Step 3: Apply labels (P2)**

  Every `<label>` element:
  ```jsx
  <label className="text-neutral-500 text-[10px] font-black uppercase tracking-wider">
  ```

- [ ] **Step 4: Apply section cards (P1)**

  Any wrapper `<div>` using `background: '#161616'` / `border: '1px solid #222'` / `borderRadius: '12px|16px'`:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-6"
  ```

- [ ] **Step 5: Apply buttons (P4)**

  Lưu button (SM Primary):
  ```jsx
  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
  style={{ background: '#FF9500' }}
  ```

  Huỷ button (SM Ghost):
  ```jsx
  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
  ```

- [ ] **Step 6: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 7: Commit**
  ```bash
  git add apps/crm/components/ClientForm.tsx
  git commit -m "style(crm): apply v1.2 style guide to ClientForm"
  ```

---

## Task 4 — `ActivityTimeline.tsx`

**Files:**
- Modify: `apps/crm/components/ActivityTimeline.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `TYPE_META`, `OUTCOME_COLORS`, form state, `createActivity`, `deleteActivity`, `loadActivities`

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/ActivityTimeline.tsx`. Look for form card wrappers (`borderRadius: '16px'`, `background: '#161616'`), form inputs (inline style or object), type selector buttons, outcome buttons, save button, and timeline item cards.

- [ ] **Step 2: Apply form card (P1)**

  The "add activity" form container:
  ```jsx
  // BEFORE
  style={{ borderRadius: '16px', background: '#161616', border: '1px solid #333', padding: '20px' }}
  // AFTER
  className="rounded-[20px] bg-surface border border-primary/10 p-5"
  ```

- [ ] **Step 3: Apply form inputs (P2)**

  All `<input>`, `<select>`, `<textarea>` in the form:
  ```jsx
  // input
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}

  // textarea
  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
  style={{ background: '#1a1a1a' }}
  ```

- [ ] **Step 4: Apply type selector buttons (P4 — XS)**

  Activity type buttons (Gọi điện, Email, Meeting, Ghi chú):
  ```jsx
  // Active (formType === type):
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all"
  style={{ background: `${meta.color}20`, color: meta.color, borderColor: `${meta.color}40` }}

  // Inactive:
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
  ```

- [ ] **Step 5: Apply outcome buttons (P4 — XS)**

  Outcome buttons (Positive, Neutral, Negative):
  ```jsx
  // Active (formOutcome === key):
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all"
  style={{ background: `${OUTCOME_COLORS[key]}20`, color: OUTCOME_COLORS[key], borderColor: `${OUTCOME_COLORS[key]}40` }}

  // Inactive:
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:border-white/20 transition-all"
  ```

- [ ] **Step 6: Apply Save button (P4 — SM Primary)**

  ```jsx
  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
  style={{ background: '#FF9500' }}
  ```

- [ ] **Step 7: Apply timeline item cards (P1)**

  Each timeline item rendered below the form, if using `background: '#161616'` / `border: '1px solid #222'`:
  ```jsx
  className="flex gap-3 p-4 rounded-[20px] border border-primary/10 bg-surface"
  ```

- [ ] **Step 8: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 9: Commit**
  ```bash
  git add apps/crm/components/ActivityTimeline.tsx
  git commit -m "style(crm): apply v1.2 style guide to ActivityTimeline"
  ```

---

## Task 5 — `PaymentTracker.tsx`

**Files:**
- Modify: `apps/crm/components/PaymentTracker.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `STATUS_MAP` colors, invoice calculation logic, `loadInvoices`, `handleClientChange`

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/PaymentTracker.tsx`. The heading is at line ~57. The client `<select>` at line ~63. Summary KPI cards from line ~74. Invoice row cards below.

- [ ] **Step 2: Apply heading (P3)**

  ```jsx
  // BEFORE
  <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>Thanh toán</h2>
  // AFTER
  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
      style={{ color: '#FF9500' }}>Thanh toán</h2>
  ```

- [ ] **Step 3: Apply client selector `<select>` (P2)**

  ```jsx
  // BEFORE
  <select style={{ width: '350px', padding: '12px 16px', background: '#1A1A1A', border: '1px solid #333',
    borderRadius: '10px', color: '#F5F5F5', fontSize: '14px', outline: 'none' }}>
  // AFTER
  <select className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full max-w-xs"
          style={{ background: '#1a1a1a' }}>
  ```

- [ ] **Step 4: Apply 4 KPI summary cards (P1 — Stats card variant)**

  Each card in the `[Tổng hóa đơn, Tổng giá trị, Đã thanh toán, Chưa thanh toán]` map:
  ```jsx
  // BEFORE
  style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px' }}
  // AFTER
  className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1"
  ```
  Keep the per-card `color` value logic (e.g., `color: '#FF9500'` for total value).
  Card label: `className="text-[10px] font-black uppercase tracking-wider text-neutral-600"`
  Card value: `className="text-2xl font-black"` + keep dynamic `style={{ color: card.color }}`

- [ ] **Step 5: Apply invoice row cards (P1)**

  Each rendered invoice in the list below the summary:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4"
  ```
  Keep all internal layout classes, only change the container.

- [ ] **Step 6: Apply empty state (P5)**

  ```jsx
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">🧾</p>
    <p className="text-neutral-600 text-sm">Chưa có hóa đơn</p>
    <p className="text-xs mt-1 text-neutral-700">Chọn khách hàng để xem lịch sử thanh toán</p>
  </div>
  ```

- [ ] **Step 7: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 8: Commit**
  ```bash
  git add apps/crm/components/PaymentTracker.tsx
  git commit -m "style(crm): apply v1.2 style guide to PaymentTracker"
  ```

---

## Task 6 — `ProjectList.tsx`

**Files:**
- Modify: `apps/crm/components/ProjectList.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `PROJECT_STATUS` colors, billing panel logic, file upload logic, R2 URL helpers (`toPublicUrl`, `isPreviewable`, `isImageUrl`, `formatSize`), `canDelete`, `fileRef`, `dropRef`

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/ProjectList.tsx`. `inputStyle` and `labelStyle` consts are at lines ~32-39. These will be deleted and replaced at every usage site.

- [ ] **Step 2: Delete `inputStyle` and `labelStyle` consts**

  Remove these two const declarations entirely:
  ```tsx
  // DELETE these lines:
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#1A1A1A', border: '1px solid #333',
    borderRadius: '8px', color: '#F5F5F5', fontSize: '13px', outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888',
  };
  ```

- [ ] **Step 3: Apply section heading (P3)**

  ```jsx
  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
      style={{ color: '#FF9500' }}>Dự án</h2>
  ```

- [ ] **Step 4: Replace all `style={inputStyle}` usages (P2)**

  Every element that had `style={inputStyle}` — replace with:
  ```jsx
  // <input>
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}

  // <select>
  className="px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors w-full"
  style={{ background: '#1a1a1a' }}

  // <textarea>
  className="w-full px-3 py-2 rounded-xl text-sm text-white border border-white/10 outline-none focus:border-orange-500/50 transition-colors resize-none"
  style={{ background: '#1a1a1a' }}
  ```

- [ ] **Step 5: Replace all `style={labelStyle}` usages (P2)**

  Every element that had `style={labelStyle}`:
  ```jsx
  className="text-neutral-500 text-[10px] font-black uppercase tracking-wider"
  ```

- [ ] **Step 6: Apply project row cards (P1)**

  Each project row container:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4 hover:border-primary/20 transition-all"
  ```

- [ ] **Step 7: Apply form modal card (P1)**

  The add/edit modal container (overlay modal or inline form card):
  ```jsx
  className="rounded-[20px] bg-surface border border-primary/10 p-6"
  ```

- [ ] **Step 8: Apply buttons (P4)**

  ```jsx
  // Thêm dự án (SM Primary)
  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
  style={{ background: '#FF9500' }}

  // Lưu (SM Primary)
  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
  style={{ background: '#FF9500' }}

  // Huỷ (SM Ghost)
  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"

  // Xoá (XS danger)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
  ```

- [ ] **Step 9: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 10: Commit**
  ```bash
  git add apps/crm/components/ProjectList.tsx
  git commit -m "style(crm): apply v1.2 style guide to ProjectList"
  ```

---

## Task 7 — `DocumentList.tsx`

**Files:**
- Modify: `apps/crm/components/DocumentList.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `DOC_TYPES`, `APPROVAL_BADGE`, upload logic, preview portal (`ReactDOM.createPortal`), contract generator wiring (`ClientContractGenerator`), R2 URL helpers

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/DocumentList.tsx`. `inputStyle` and `labelStyle` are at lines ~34-41. Same pattern as ProjectList.

- [ ] **Step 2: Delete `inputStyle` and `labelStyle` consts**

  Remove both const declarations (same as Task 6 Step 2).

- [ ] **Step 3: Replace all `style={inputStyle}` usages (P2)**

  Same replacement as Task 6 Step 4. Apply to all `<input>`, `<select>`, `<textarea>`.

- [ ] **Step 4: Replace all `style={labelStyle}` usages (P2)**

  Same replacement as Task 6 Step 5.

- [ ] **Step 5: Apply document row cards (P1)**

  Each document row:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4 hover:border-primary/20 transition-all"
  ```

- [ ] **Step 6: Apply form section card (P1)**

  The upload/add form container:
  ```jsx
  className="rounded-[20px] bg-surface border border-primary/10 p-6"
  ```

- [ ] **Step 7: Apply heading (P3)**

  ```jsx
  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
      style={{ color: '#FF9500' }}>Tài liệu</h2>
  ```

- [ ] **Step 8: Apply buttons (P4)**

  ```jsx
  // Upload / Lưu (SM Primary)
  className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all disabled:opacity-50"
  style={{ background: '#FF9500' }}

  // Huỷ (SM Ghost)
  className="px-4 py-2 rounded-xl text-xs font-black uppercase text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"

  // Xem / Tải (XS ghost)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"

  // Xoá (XS danger)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
  ```

- [ ] **Step 9: Apply empty state (P5)**

  ```jsx
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">📂</p>
    <p className="text-neutral-600 text-sm">Chưa có tài liệu nào</p>
    <p className="text-xs mt-1 text-neutral-700">Upload tài liệu để lưu trữ tập trung</p>
  </div>
  ```

- [ ] **Step 10: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 11: Commit**
  ```bash
  git add apps/crm/components/DocumentList.tsx
  git commit -m "style(crm): apply v1.2 style guide to DocumentList"
  ```

---

## Task 8 — `EmailOutreach.tsx`

**Files:**
- Modify: `apps/crm/components/EmailOutreach.tsx`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: nothing consumed by other tasks
- Do NOT touch: `STATUS_CFG`, `TIER_CFG`, all API logic (`outreachRequest`, `getOutreachApiBase`, `supabaseEdgeFunctionPost`), `AutoTab` component, `loadAll`, sub-tab state

- [ ] **Step 1: Read the file**

  Open `apps/crm/components/EmailOutreach.tsx`. `inputStyle` and `labelStyle` are at lines ~29-36. The file is the most complex — it has multiple sub-tabs (`dashboard`, `leads`, `discovery`, `emails`, `analytics`, `auto`, `settings`), each rendering different content.

- [ ] **Step 2: Delete `inputStyle` and `labelStyle` consts**

  Remove both const declarations (same pattern as Task 6 Step 2).

- [ ] **Step 3: Replace all `style={inputStyle}` usages (P2)**

  Same replacement as Task 6 Step 4. There may be many usage sites across different sub-tab render blocks — search for `style={inputStyle}` and replace every occurrence.

- [ ] **Step 4: Replace all `style={labelStyle}` usages (P2)**

  Same replacement as Task 6 Step 5.

- [ ] **Step 5: Apply sub-tab navigation buttons (P4 — XS)**

  The tab buttons (dashboard, leads, discovery, emails, analytics, auto, settings):
  ```jsx
  // Active (tab === value)
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all"
  style={{ background: 'rgba(255,149,0,0.15)', color: '#FF9500', borderColor: 'rgba(255,149,0,0.3)' }}

  // Inactive
  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-neutral-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
  ```

- [ ] **Step 6: Apply lead row cards (P1)**

  Each outreach lead card/row:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4 hover:border-primary/20 transition-all"
  ```

- [ ] **Step 7: Apply stats/KPI cards (P1)**

  Stats cards in the dashboard sub-tab:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-5 space-y-1"
  ```
  Label: `className="text-[10px] font-black uppercase tracking-wider text-neutral-600"`
  Value: `className="text-2xl font-black text-white"`

- [ ] **Step 8: Apply template cards (P1)**

  Email template cards:
  ```jsx
  className="rounded-[20px] border border-primary/10 bg-surface p-4"
  ```

- [ ] **Step 9: Apply empty states (P5)**

  Any empty states in leads or analytics tabs:
  ```jsx
  <div className="text-center py-16 text-neutral-700 text-sm">
    <p className="text-3xl mb-3">📧</p>
    <p className="text-neutral-600 text-sm">Chưa có dữ liệu outreach</p>
    <p className="text-xs mt-1 text-neutral-700">Thêm lead để bắt đầu chiến dịch email</p>
  </div>
  ```

- [ ] **Step 10: Build**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0.

- [ ] **Step 11: Commit**
  ```bash
  git add apps/crm/components/EmailOutreach.tsx
  git commit -m "style(crm): apply v1.2 style guide to EmailOutreach"
  ```

---

## Final Validation

- [ ] **Full build check**
  ```bash
  cd /Users/tdgames_mac01/Work/apps/tdgames-platforms && npm run build
  ```
  Expected: exits 0, zero TypeScript errors across all 8 modified files.

- [ ] **Visual spot-check** (optional): Start dev server and verify CRM tabs render correctly with no broken layout.
  ```bash
  npm run dev
  ```
  Open http://localhost:3000, navigate to CRM, check: Khách hàng, Dự án, Tài liệu, Thanh toán, Hoạt động, Outreach tabs.
