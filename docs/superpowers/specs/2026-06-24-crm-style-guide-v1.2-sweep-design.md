# CRM Style Guide v1.2 Full Sweep — Design Spec

_Date: 2026-06-24 | Author: Claude (brainstorming session)_

---

## Overview

Apply the TD Games Platform Style Guide v1.2 consistently across all CRM components that still use
pre-v1.2 patterns. The goal is visual consistency with the rest of the Platform (Expense app, etc.)
and compliance with the approved pattern library.

**Scope:** 8 component files in `apps/crm/components/`

**Approach:** Sequential file-by-file rewrite (Approach A) — each file is updated independently,
preserving all logic and data flow. Only styling changes: no new features, no restructuring of
component props or state.

---

## Shared Pattern Replacements

These 4 substitutions apply across every file:

### 1. Card containers

| Before | After |
|--------|-------|
| `background: '#161616'` + `border: '1px solid #222'` + `borderRadius: '12px\|16px'` | `className="rounded-[20px] border border-primary/10 bg-surface"` |
| Primary-tinted card (sidebar/highlight): `background: 'rgba(255,149,0,0.03)'` + `borderColor: '#333'` | `className="rounded-[20px] border p-5" style={{ background: 'rgba(255,149,0,0.03)', borderColor: 'rgba(255,149,0,0.12)' }}` |

### 2. Form inputs & labels

```jsx
// Before (inputStyle object)
{ width: '100%', padding: '10px 14px', background: '#1A1A1A',
  border: '1px solid #333', borderRadius: '8px', color: '#F5F5F5',
  fontSize: '13px', outline: 'none' }

// After (Tailwind + inline)
className="px-3 py-2 rounded-xl text-sm text-white border border-white/10
           outline-none focus:border-orange-500/50 transition-colors w-full"
style={{ background: '#1a1a1a' }}

// Before (labelStyle object)
{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: '#888' }

// After
className="text-neutral-500 text-[10px] font-black uppercase tracking-wider"
```

### 3. Section headings

```jsx
// Before (inline)
style={{ fontSize: '2rem', fontWeight: 900, color: '#FF9500',
         textTransform: 'uppercase', letterSpacing: '-0.03em' }}

// After (Tailwind)
className="text-2xl md:text-4xl font-black uppercase tracking-tighter"
style={{ color: '#FF9500' }}
```

### 4. Buttons

```jsx
// XS — inline action (Xem, Sửa, Xoá icon)
className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider
           text-neutral-300 border border-white/10
           hover:text-white hover:border-white/20 transition-all"

// SM Primary (Thêm, Lưu)
className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider
           text-white transition-all disabled:opacity-50"
style={{ background: '#FF9500' }}

// SM Ghost (Huỷ)
className="px-4 py-2 rounded-xl text-xs font-black uppercase
           text-neutral-400 border border-white/10 hover:bg-white/5 transition-all"
```

### 5. Empty states

```jsx
// Before: ad-hoc inline styles
// After: style guide pattern
<div className="text-center py-16 text-neutral-700 text-sm">
  <p className="text-3xl mb-3">{emoji}</p>
  <p className="text-neutral-600 text-sm">Chưa có dữ liệu</p>
  <p className="text-xs mt-1 text-neutral-700">Gợi ý action nếu có</p>
</div>
```

---

## File-by-File Changes

### 1. `apps/crm/components/CrmApp.tsx` — `GlobalActivityFeed`

**What changes:**
- `<h2>` heading → Tailwind heading pattern
- 5 filter buttons (Tất cả, Gọi điện, Email, Meeting, Ghi chú) → XS button classes; active state uses `bg-orange-500/15 text-orange-400` or per-color equivalent
- Activity row cards: `background: '#161616'` + `border: '1px solid #222'` + `borderRadius: '12px'` → `rounded-[20px] border border-primary/10 bg-surface hover:border-primary/20`
- Icon container: `borderRadius: '12px'` → `rounded-xl`
- Empty state → style guide empty state pattern
- Loading state → `animate-td-pulse` on text

**What does NOT change:** data fetch logic, `fetchActivities`, filtering, `TYPE_ICON` map.

---

### 2. `apps/crm/components/ClientList.tsx`

**What changes:**
- `<h2>` heading → Tailwind heading pattern
- Stats cards grid: each card `background: '#161616'` → `rounded-[20px] border border-primary/10 bg-surface`; first card value color stays `#FF9500` (orange for "Tổng")
- `selectStyle` (used on search input + 2 selects) → style guide input/select classes
- Client row cards: `background: '#161616'` + `border: '1px solid #222'` + `borderRadius: '12px'` → `rounded-[20px] border border-primary/10 bg-surface hover:border-primary/20`
- Inline action buttons (Sửa, Xoá icon, Xác nhận, Huỷ) → XS button classes
- Empty state → style guide empty state pattern

**What does NOT change:** `STATUS_CONFIG` colors, `canDelete` logic, `deleteConfirm` state, all prop wiring.

---

### 3. `apps/crm/components/PaymentTracker.tsx`

**What changes:**
- `<h2>` heading → Tailwind heading pattern
- Client selector `<select>` → style guide select class (width becomes `w-full max-w-xs`)
- 4 KPI summary cards: `background: '#161616'` + `border: '1px solid #222'` → `rounded-[20px] border border-primary/10 bg-surface`
- Invoice row cards (each invoice rendered as a card in the list below the summary) → `rounded-[20px] border border-primary/10 bg-surface`
- Empty state → style guide empty state pattern

**What does NOT change:** `STATUS_MAP` colors, invoice calculation logic, `loadInvoices`.

---

### 4. `apps/crm/components/ProjectList.tsx`

**What changes:**
- `inputStyle` const removed → replaced with Tailwind classes at each usage site
- `labelStyle` const removed → replaced with `className="text-neutral-500 text-[10px] font-black uppercase tracking-wider"`
- Section heading → Tailwind heading pattern
- Project row cards → `rounded-[20px] border border-primary/10 bg-surface`
- Form modal (add/edit) card → `rounded-[20px] bg-surface border-primary/10`
- Buttons (Thêm, Lưu, Huỷ, Xoá) → SM/XS button classes

**What does NOT change:** `PROJECT_STATUS` colors, billing panel logic, file upload logic, R2 URL helpers.

---

### 5. `apps/crm/components/DocumentList.tsx`

**What changes:**
- `inputStyle` const removed → replaced with Tailwind classes at each usage site
- `labelStyle` const removed → replaced with style guide label class
- Document row cards → `rounded-[20px] border border-primary/10 bg-surface`
- Form section → `rounded-[20px] bg-surface border-primary/10`
- Approval badge row → keep `APPROVAL_BADGE` colors, update card container only
- Buttons → SM/XS button classes

**What does NOT change:** `DOC_TYPES`, `APPROVAL_BADGE`, upload logic, preview portal, contract generator wiring.

---

### 6. `apps/crm/components/EmailOutreach.tsx`

**What changes:**
- `inputStyle` const removed → replaced with Tailwind classes
- `labelStyle` const removed → replaced with style guide label class
- Sub-tab buttons → XS button classes (active: `bg-orange-500/15 text-orange-400`, inactive: ghost)
- Lead row cards → `rounded-[20px] border border-primary/10 bg-surface`
- Stats/KPI cards → `rounded-[20px] border border-primary/10 bg-surface`
- Template cards → `rounded-[20px] border border-primary/10 bg-surface`

**What does NOT change:** `STATUS_CFG`, `TIER_CFG`, all API logic (`outreachRequest`, `getOutreachApiBase`), `AutoTab` component.

---

### 7. `apps/crm/components/ActivityTimeline.tsx`

**What changes:**
- Form card: `rounded-[16px]` + `background: '#161616'` → `rounded-[20px] bg-surface border-primary/10`
- Form inputs: `rgba(255,255,255,0.04)` border/bg → style guide input pattern (`border-white/10`, `style={{ background: '#1a1a1a' }}`)
- Type selector buttons → XS button classes with per-color active states (already close, minor cleanup)
- Outcome buttons → XS button classes with status colors
- Save button → SM primary button class (gradient already correct, but swap to style guide class)
- Timeline item cards → if using `#161616/#222` pattern, update to `bg-surface border-primary/10`

**What does NOT change:** `TYPE_META`, `OUTCOME_COLORS`, form state, `createActivity`, `deleteActivity`.

---

### 8. `apps/crm/components/ClientForm.tsx`

**What changes:**
- All `<input>`, `<select>`, `<textarea>` → style guide input classes
- Form section cards (if any `background: '#161616'` wrappers) → `rounded-[20px] bg-surface border-primary/10`
- Label elements → style guide label class
- Buttons (Lưu, Huỷ) → SM primary / SM ghost classes

**What does NOT change:** form state, validation, `onSave`/`onUpdate`/`onCancel` wiring, contact management logic.

---

## Constraints

- **No logic changes** — all state, props, services, event handlers remain identical
- **No new features** — purely style token replacement
- **No `max-w-*`** inside tab components — already respected by parent shell
- **No `hover:scale-105` or `hover:translateY`** — dashboard pattern
- **`rounded-[20px]`** not `rounded-2xl` for all cards
- **`border-primary/10`** not `border-white/8` for card borders
- **`bg-surface`** (`#1A1A1A`) for card backgrounds — NOT `#161616`

---

## Validation

After each file is updated, run:
```bash
npm run build
```
Full suite must pass. No TypeScript errors introduced (style changes are prop-safe).

---

## Order of Execution

1. `CrmApp.tsx` (GlobalActivityFeed) — highest visibility, global activity feed
2. `ClientList.tsx` — most-used tab, many cards
3. `ClientForm.tsx` — used for add/edit client
4. `ActivityTimeline.tsx` — embedded in ClientForm
5. `PaymentTracker.tsx`
6. `ProjectList.tsx`
7. `DocumentList.tsx`
8. `EmailOutreach.tsx` — most complex, last
