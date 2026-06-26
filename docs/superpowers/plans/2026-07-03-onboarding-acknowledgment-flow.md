# Onboarding Acknowledgment Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sau khi nhân viên mới hoàn thành profile, app tự động hiển thị màn hình Onboarding bắt buộc — nhân viên phải tick checkbox từng bài handbook được admin đánh dấu "bắt buộc" thì mới vào được HomeScreen.

**Architecture:** Thêm state `needsOnboarding` vào App.tsx state machine. Khi profile hoàn chỉnh, kiểm tra DB xem `onboarding_completed_at` có null không + có required articles không — nếu cần thì render `OnboardingScreen` (step 3 của invite flow). Sau khi nhân viên tick xong tất cả → insert `hr_onboarding_acknowledgments` + set `onboarding_completed_at` → vào portal như bình thường.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL + supabase-js), Tailwind CSS, TDD via `npm run build` (TypeScript compile check).

## Global Constraints

- Style: follow Style Guide v1.4 — `rounded-[20px]` cho cards, `border-primary/10`, không dùng `hover:scale-*`, không `duration-500+`
- Không dùng `max-w-*` trong component chính (parent lo)
- Background: `#0F0F0F`, brand: `#FF9500`
- Không commit `.agent/meta/` files
- Build check (`npm run build`) bắt buộc trước mỗi commit
- Admin/ke_toan/hr roles KHÔNG bị chặn bởi onboarding flow — chỉ áp dụng cho `member` và `freelancer`
- "Once completed = always done" — `onboarding_completed_at` không reset khi thêm bài mới

---

## File Structure Map

```
supabase/migrations/
  20260703200000_onboarding_flow.sql          [CREATE] DB schema

types.ts                                       [MODIFY] +is_required, +onboarding_completed_at, +HrOnboardingAck

apps/handbook/services/handbookService.ts      [MODIFY] +fetchRequiredArticles(), +submitOnboardingAcks()

apps/company/components/HandbookAdminTab.tsx   [MODIFY] toggle is_required per article

components/OnboardingScreen.tsx                [CREATE] màn hình onboarding step-by-step

App.tsx                                        [MODIFY] thêm needsOnboarding state + step 3 trong invite flow
```

---

## Tasks

---

### Task 1: DB Migration — Thêm schema cho onboarding flow

**Files:**
- Create: `supabase/migrations/20260703200000_onboarding_flow.sql`

**Interfaces:**
- Consumes: nothing
- Produces:
  - Column `handbook_articles.is_required boolean DEFAULT false`
  - Column `hr_employees.onboarding_completed_at timestamptz NULL`
  - Table `hr_onboarding_acknowledgments(id, employee_id, article_id, acknowledged_at)` với UNIQUE constraint

- [ ] **Step 1: Tạo file migration**

```sql
-- supabase/migrations/20260703200000_onboarding_flow.sql

-- 1. Đánh dấu bài handbook là "bắt buộc đọc khi onboarding"
ALTER TABLE handbook_articles
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN handbook_articles.is_required IS
  'Admin đánh dấu bài này bắt buộc nhân viên mới phải đọc và tick xác nhận trước khi vào app.';

-- 2. Ghi nhận thời điểm nhân viên hoàn thành onboarding
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

COMMENT ON COLUMN hr_employees.onboarding_completed_at IS
  'NULL = chưa hoàn thành onboarding acknowledgment. SET = đã xem và tick tất cả bài bắt buộc.';

-- 3. Lưu từng bài nhân viên đã acknowledge
CREATE TABLE IF NOT EXISTS hr_onboarding_acknowledgments (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  article_id    uuid NOT NULL REFERENCES handbook_articles(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, article_id)
);

COMMENT ON TABLE hr_onboarding_acknowledgments IS
  'Mỗi row = nhân viên đã tick xác nhận đọc 1 bài handbook bắt buộc.';

-- RLS: nhân viên chỉ thấy acknowledgment của mình; admin thấy tất cả
ALTER TABLE hr_onboarding_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_own_acks" ON hr_onboarding_acknowledgments
  FOR ALL USING (
    auth.uid() = employee_id
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'role') IN ('admin', 'hr', 'ke_toan')
    )
  );
```

- [ ] **Step 2: Apply migration lên Supabase**

Dùng Supabase MCP tool `apply_migration`:
```
name: "onboarding_flow"
query: <nội dung SQL ở trên>
```

Verify: Không có lỗi, output `{"success": true}`.

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/20260703200000_onboarding_flow.sql
git commit -m "feat(onboarding): DB migration — is_required, onboarding_completed_at, hr_onboarding_acknowledgments"
```

---

### Task 2: Types + handbookService — Thêm types và service functions

**Files:**
- Modify: `types.ts`
- Modify: `apps/handbook/services/handbookService.ts`

**Interfaces:**
- Consumes: Task 1 (DB schema)
- Produces:
  - `HandbookArticle.is_required: boolean` (field mới)
  - `HrEmployee.onboarding_completed_at?: string | null` (field mới)
  - `HrOnboardingAck` interface
  - `fetchRequiredArticles(): Promise<HandbookArticle[]>`
  - `submitOnboardingAcks(employeeId: string, articleIds: string[]): Promise<void>`
  - `checkOnboardingStatus(employeeId: string): Promise<boolean>` — trả về `true` nếu cần onboarding

- [ ] **Step 1: Update `types.ts` — HandbookArticle, HrEmployee, thêm HrOnboardingAck**

Tìm `export interface HandbookArticle` (line ~1193), thêm field `is_required`:

```typescript
export interface HandbookArticle {
  id: string;
  category_id: string;
  title: string;
  content: string;
  is_published: boolean;
  is_required: boolean;          // ← THÊM MỚI
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

Tìm `onboarding_completed_at` comment trong `HrEmployee` (cuối interface, sau `is_hidden`), thêm:

```typescript
  /** Ẩn khỏi danh bạ Company Hub (dùng cho test accounts) */
  is_hidden?: boolean;
  /** Thời điểm hoàn thành onboarding acknowledgment. NULL = chưa xong. */
  onboarding_completed_at?: string | null;
```

Thêm interface mới sau `HrEmployee`:

```typescript
export interface HrOnboardingAck {
  id: string;
  employee_id: string;
  article_id: string;
  acknowledged_at: string;
}
```

- [ ] **Step 2: Update `handbookService.ts` — thêm 3 functions**

Append vào cuối file:

```typescript
// ── Onboarding ──────────────────────────────────────────────────

/** Fetch tất cả bài published + is_required = true, dùng cho OnboardingScreen */
export async function fetchRequiredArticles(): Promise<HandbookArticle[]> {
  const { data, error } = await supabase
    .from('handbook_articles')
    .select('*')
    .eq('is_required', true)
    .eq('is_published', true)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Kiểm tra xem nhân viên có cần làm onboarding không.
 * Returns true nếu: có required articles + onboarding_completed_at IS NULL
 */
export async function checkOnboardingNeeded(employeeId: string): Promise<boolean> {
  const [{ data: emp }, { data: arts }] = await Promise.all([
    supabase
      .from('hr_employees')
      .select('onboarding_completed_at')
      .eq('id', employeeId)
      .single(),
    supabase
      .from('handbook_articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_required', true)
      .eq('is_published', true),
  ]);
  if (!emp) return false;
  if (emp.onboarding_completed_at) return false; // đã hoàn thành rồi
  return (arts as any)?.length > 0 || false;
}

/**
 * Submit acknowledgments sau khi nhân viên tick xong tất cả bài bắt buộc.
 * Insert vào hr_onboarding_acknowledgments + set onboarding_completed_at.
 */
export async function submitOnboardingAcks(
  employeeId: string,
  articleIds: string[],
): Promise<void> {
  // Insert acknowledgments (upsert để safe nếu gọi 2 lần)
  if (articleIds.length > 0) {
    const rows = articleIds.map(article_id => ({ employee_id: employeeId, article_id }));
    const { error: ackErr } = await supabase
      .from('hr_onboarding_acknowledgments')
      .upsert(rows, { onConflict: 'employee_id,article_id' });
    if (ackErr) throw ackErr;
  }
  // Mark employee onboarding done
  const { error: empErr } = await supabase
    .from('hr_employees')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', employeeId);
  if (empErr) throw empErr;
}
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — không có TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add types.ts apps/handbook/services/handbookService.ts
git commit -m "feat(onboarding): types + service — fetchRequiredArticles, checkOnboardingNeeded, submitOnboardingAcks"
```

---

### Task 3: HandbookAdminTab — Thêm toggle is_required

**Files:**
- Modify: `apps/company/components/HandbookAdminTab.tsx`

**Interfaces:**
- Consumes:
  - `HandbookArticle.is_required: boolean` (từ Task 2)
  - `updateArticle(id, { is_required: boolean })` từ `handbookService.ts` (function đã có, chỉ cần truyền field mới)
- Produces: Admin có thể toggle "Bắt buộc" per article trong danh sách + editor

- [ ] **Step 1: Thêm toggle is_required trong Article Editor (form)**

Tìm đoạn toggle `is_published` trong article editor (khoảng line 271-283), thêm toggle `is_required` ngay sau:

```tsx
{/* Sau toggle is_published */}
<label className="flex items-center gap-2 cursor-pointer">
  <div
    onClick={() => setEditArt(a => a && { ...a, is_required: !a.is_required })}
    className="w-10 h-5 rounded-full transition-all relative"
    style={{ background: editArt.is_required ? '#FF9500' : 'rgba(255,255,255,0.1)' }}
  >
    <div className="absolute top-0.5 transition-all w-4 h-4 bg-white rounded-full shadow"
      style={{ left: editArt.is_required ? '22px' : '2px' }} />
  </div>
  <span className="text-xs font-bold text-neutral-400">
    {editArt.is_required ? '📌 Bắt buộc onboarding' : '⬜ Không bắt buộc'}
  </span>
</label>
```

Cũng cần update `saveArt()` để truyền `is_required` khi create và update. Tìm `updateArticle(editArt.id, {` — thêm `is_required: editArt.is_required ?? false,` vào payload. Tương tự cho `createArticle`.

Đây là đoạn `saveArt` cần sửa:

```typescript
// Khi UPDATE:
const updated = await updateArticle(editArt.id, {
  title: editArt.title.trim(),
  content: editArt.content ?? '',
  is_published: editArt.is_published ?? false,
  is_required: editArt.is_required ?? false,   // ← THÊM
});

// Khi CREATE:
const created = await createArticle({
  category_id: selectedCatId,
  title: editArt.title.trim(),
  content: editArt.content ?? '',
  is_published: editArt.is_published ?? false,
  is_required: editArt.is_required ?? false,   // ← THÊM
  order_index: articles.length,
  created_by: adminUserId,
});
```

- [ ] **Step 2: Thêm badge "Bắt buộc" trong Article List item**

Tìm badge `is_published` trong article list (khoảng line 335):

```tsx
<span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${art.is_published ? 'bg-green-500/15 text-green-400' : 'bg-white/8 text-neutral-500'}`}>
  {art.is_published ? 'Công khai' : 'Nháp'}
</span>
```

Thêm badge is_required ngay sau:

```tsx
{art.is_required && (
  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">
    📌 Bắt buộc
  </span>
)}
```

- [ ] **Step 3: Fix TypeScript — update `updateArticle` + `createArticle` payloads in handbookService.ts**

`updateArticle` đang nhận `Partial<Pick<HandbookArticle, 'title' | 'content' | 'is_published' | 'order_index' | 'category_id'>>` — thêm `'is_required'` vào Pick:

```typescript
export async function updateArticle(
  id: string,
  payload: Partial<Pick<HandbookArticle, 'title' | 'content' | 'is_published' | 'is_required' | 'order_index' | 'category_id'>>,
): Promise<HandbookArticle> {
```

`createArticle` đang nhận `Pick<HandbookArticle, 'category_id' | 'title' | 'content' | 'is_published' | 'order_index' | 'created_by'>` — thêm `'is_required'`:

```typescript
export async function createArticle(
  payload: Pick<HandbookArticle, 'category_id' | 'title' | 'content' | 'is_published' | 'is_required' | 'order_index' | 'created_by'>,
): Promise<HandbookArticle> {
```

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — không có TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/company/components/HandbookAdminTab.tsx apps/handbook/services/handbookService.ts
git commit -m "feat(onboarding): HandbookAdmin — toggle is_required per article"
```

---

### Task 4: OnboardingScreen — Màn hình onboarding bắt buộc

**Files:**
- Create: `components/OnboardingScreen.tsx`

**Interfaces:**
- Consumes:
  - `fetchRequiredArticles(): Promise<HandbookArticle[]>` (Task 2)
  - `submitOnboardingAcks(employeeId, articleIds): Promise<void>` (Task 2)
  - `AccountUser` from `@/types`
- Produces:
  - `<OnboardingScreen currentUser={AccountUser} onComplete={() => void} />`
  - Gọi `onComplete()` sau khi nhân viên tick xong tất cả và ấn "Bắt đầu sử dụng"

- [ ] **Step 1: Tạo `components/OnboardingScreen.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { AccountUser } from '@/types';
import { fetchRequiredArticles, submitOnboardingAcks } from '@/apps/handbook/services/handbookService';
import type { HandbookArticle } from '@/types';

interface Props {
  currentUser: AccountUser;
  onComplete: () => void;
}

export function OnboardingScreen({ currentUser, onComplete }: Props) {
  const [articles, setArticles] = useState<HandbookArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRequiredArticles()
      .then(arts => {
        setArticles(arts);
        // Auto-expand bài đầu tiên
        if (arts.length > 0) setExpandedId(arts[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const allChecked = articles.length > 0 && checked.size === articles.length;

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!allChecked || !currentUser.employee_id) return;
    setSubmitting(true);
    setError('');
    try {
      await submitOnboardingAcks(currentUser.employee_id, [...checked]);
      onComplete();
    } catch (e: any) {
      setError(e.message || 'Lỗi lưu xác nhận');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <p className="text-neutral-600 text-sm animate-pulse">Đang tải nội quy công ty...</p>
      </div>
    );
  }

  // Nếu không có bài nào bắt buộc (admin chưa set) — bỏ qua
  if (articles.length === 0) {
    onComplete();
    return null;
  }

  const doneCount = checked.size;
  const totalCount = articles.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ backgroundColor: '#0F0F0F' }}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full blur-[120px] opacity-15"
          style={{ width: '600px', height: '600px', background: 'radial-gradient(circle, #FF9500 0%, transparent 70%)', top: '-200px', left: '-150px' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 pt-12 pb-8 px-6 text-center">
        <img
          src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png"
          alt="TD Games"
          className="w-12 h-12 object-contain mx-auto mb-4"
        />
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">
          Chào mừng, {currentUser.username}! 👋
        </h1>
        <p className="text-neutral-500 text-sm max-w-md mx-auto">
          Trước khi bắt đầu, vui lòng đọc và xác nhận từng nội quy bắt buộc dưới đây.
        </p>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 px-6 max-w-2xl mx-auto w-full mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Tiến độ xác nhận</span>
          <span className="text-[10px] font-black text-primary">{doneCount}/{totalCount} bài</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: '#FF9500' }}
          />
        </div>
      </div>

      {/* Article list */}
      <main className="relative z-10 flex-1 px-6 max-w-2xl mx-auto w-full space-y-3 pb-8">
        {articles.map((art, idx) => {
          const isChecked = checked.has(art.id);
          const isExpanded = expandedId === art.id;

          return (
            <div
              key={art.id}
              className="rounded-[20px] border transition-all overflow-hidden"
              style={{
                borderColor: isChecked ? 'rgba(52,199,89,0.3)' : 'rgba(255,149,0,0.15)',
                background: isChecked ? 'rgba(52,199,89,0.04)' : 'rgba(255,149,0,0.03)',
              }}
            >
              {/* Article header — click to expand */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : art.id)}
                className="w-full flex items-center gap-4 p-4 text-left"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: isChecked ? 'rgba(52,199,89,0.15)' : 'rgba(255,149,0,0.1)', color: isChecked ? '#34C759' : '#FF9500' }}>
                  {isChecked ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${isChecked ? 'text-neutral-400 line-through' : 'text-white'}`}>
                    {art.title}
                  </p>
                </div>
                <span className="text-neutral-600 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {/* Article content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  <div className="text-neutral-300 text-sm leading-7 whitespace-pre-wrap border-t border-white/5 pt-4"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {art.content || <span className="text-neutral-700 italic">Bài viết chưa có nội dung.</span>}
                  </div>

                  {/* Acknowledge checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:border-primary/20 transition-all"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheck(art.id)}
                      className="w-4 h-4 mt-0.5 accent-orange-500 flex-shrink-0"
                    />
                    <span className="text-xs text-neutral-400 leading-snug">
                      Tôi đã đọc và hiểu nội quy này. Tôi đồng ý tuân thủ theo quy định của công ty.
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Footer CTA */}
      <footer className="relative z-10 px-6 py-6 border-t border-white/5 max-w-2xl mx-auto w-full">
        {error && (
          <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!allChecked || submitting}
          className="w-full py-4 rounded-[20px] font-black text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: allChecked ? '#FF9500' : 'rgba(255,149,0,0.2)', color: allChecked ? '#000' : '#FF9500' }}
        >
          {submitting ? 'Đang lưu...' : allChecked ? '🚀 Bắt đầu sử dụng TD Games Platform' : `Còn ${totalCount - doneCount} bài chưa xác nhận`}
        </button>
        <p className="text-center text-neutral-700 text-[10px] mt-3">
          Bằng cách ấn nút trên, bạn xác nhận đã đọc và đồng ý toàn bộ nội quy.
        </p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — không TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/OnboardingScreen.tsx
git commit -m "feat(onboarding): OnboardingScreen — read + checkbox acknowledgment flow"
```

---

### Task 5: App.tsx — Wire onboarding vào state machine

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes:
  - `OnboardingScreen` from `./components/OnboardingScreen` (Task 4)
  - `checkOnboardingNeeded(employeeId): Promise<boolean>` (Task 2)
  - `currentUser.employee_id: string | undefined`
- Produces: State machine hoàn chỉnh:
  ```
  invited_at && !password_set → SetPasswordScreen
  member/freelancer + profile incomplete → ProfileCompletionScreen
  member/freelancer + onboarding_completed_at IS NULL + has required articles → OnboardingScreen  ← MỚI
  Complete → HomeScreen / portal
  ```
  Admin/ke_toan/hr KHÔNG đi qua OnboardingScreen.

- [ ] **Step 1: Import OnboardingScreen và checkOnboardingNeeded**

Thêm vào đầu `App.tsx` (sau các import hiện có):

```typescript
import { OnboardingScreen } from './components/OnboardingScreen';
import { checkOnboardingNeeded } from './apps/handbook/services/handbookService';
```

- [ ] **Step 2: Thêm state `needsOnboarding`**

Tìm:
```typescript
const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
```

Thêm ngay sau:
```typescript
const [needsOnboarding, setNeedsOnboarding] = useState(false);
```

- [ ] **Step 3: Thêm helper `checkAndSetOnboarding`**

Thêm function sau `checkProfileCompletion`:

```typescript
/** Kiểm tra và set needsOnboarding nếu nhân viên cần làm onboarding */
const checkAndSetOnboarding = async (employeeId: string) => {
  try {
    const needed = await checkOnboardingNeeded(employeeId);
    if (needed) setNeedsOnboarding(true);
  } catch {
    // Nếu lỗi, không block — cho qua bình thường
  }
};
```

- [ ] **Step 4: Tích hợp vào `checkNeedsOnboarding` (initial load)**

Tìm đoạn trong `checkNeedsOnboarding`:
```typescript
// Case 3: Password is set — check profile completion from DB
const role = parseRole(meta.role || 'member');
const employeeId = meta.employee_id;
if ((role === 'member' || role === 'freelancer') && employeeId) {
  await checkProfileCompletion(employeeId, role as string);
}
```

Thay bằng:
```typescript
// Case 3: Password is set — check profile completion từ DB
const role = parseRole(meta.role || 'member');
const employeeId = meta.employee_id;
if ((role === 'member' || role === 'freelancer') && employeeId) {
  await checkProfileCompletion(employeeId, role as string);
  // Nếu profile đã đầy đủ (needsProfileCompletion vẫn false), check onboarding
  // Lưu ý: checkProfileCompletion set needsProfileCompletion nếu thiếu
  // Nên check onboarding chỉ khi profile complete
  const profile = await import('./apps/portal/services/portalService').then(m => m.fetchMyProfile(employeeId));
  const keys = role === 'freelancer' ? FREELANCER_REQUIRED_KEYS : EMPLOYEE_REQUIRED_KEYS;
  const missing = keys.filter(key => {
    const v = (profile as any)?.[key];
    return !v || (typeof v === 'string' && v.trim().length === 0);
  });
  if (missing.length === 0) {
    // Profile đầy đủ → check onboarding
    await checkAndSetOnboarding(employeeId);
  }
}
```

**Lưu ý:** đoạn này có vẻ gọi `fetchMyProfile` 2 lần (cả trong `checkProfileCompletion`). Để tránh double-fetch, refactor `checkProfileCompletion` trả về `boolean` về completeness. Nhưng để đơn giản và an toàn, giữ nguyên cách cũ và accept 2 calls — chỉ chạy 1 lần khi load, không ảnh hưởng UX.

- [ ] **Step 5: Tích hợp vào `ProfileCompletionScreen.onComplete()`**

Tìm:
```typescript
<ProfileCompletionScreen
  currentUser={currentUser}
  onComplete={() => {
    setNeedsProfileCompletion(false);
    setActiveApp(hasRole(currentUser, 'freelancer') ? 'freelancer-portal' : 'portal');
  }}
/>
```

Thay bằng:
```typescript
<ProfileCompletionScreen
  currentUser={currentUser}
  onComplete={async () => {
    setNeedsProfileCompletion(false);
    // Sau khi profile xong, check onboarding
    if (currentUser.employee_id) {
      const needed = await checkOnboardingNeeded(currentUser.employee_id).catch(() => false);
      if (needed) {
        setNeedsOnboarding(true);
        return;
      }
    }
    setActiveApp(hasRole(currentUser, 'freelancer') ? 'freelancer-portal' : 'portal');
  }}
/>
```

- [ ] **Step 6: Render OnboardingScreen — thêm vào state machine (sau ProfileCompletionScreen block)**

Tìm:
```typescript
// ── Invite flow: Step 2 — Profile completion ──
if (needsProfileCompletion && currentUser && currentUser.employee_id) {
  return ( <ProfileCompletionScreen ... /> );
}
```

Thêm ngay sau:
```typescript
// ── Invite flow: Step 3 — Onboarding acknowledgment ──
if (needsOnboarding && currentUser && currentUser.employee_id) {
  return (
    <OnboardingScreen
      currentUser={currentUser}
      onComplete={() => {
        setNeedsOnboarding(false);
        setActiveApp(hasRole(currentUser, 'freelancer') ? 'freelancer-portal' : 'portal');
      }}
    />
  );
}
```

- [ ] **Step 7: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — không TypeScript errors.

- [ ] **Step 8: Commit + Push**

```bash
git add App.tsx
git commit -m "feat(onboarding): wire OnboardingScreen vào App.tsx state machine (step 3 invite flow)"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ Admin tag bài "bắt buộc": Task 3 — toggle `is_required` trong HandbookAdminTab
- ✅ Màn hình hiển thị các bài bắt buộc: Task 4 — `OnboardingScreen`
- ✅ Tick checkbox từng bài: Task 4 — checkbox per article + state `checked: Set<string>`
- ✅ Tất cả tick rồi mới qua: Task 4 — button disabled until `allChecked`
- ✅ Sau profile completion → onboarding: Task 5 — `ProfileCompletionScreen.onComplete()` gọi `checkOnboardingNeeded`
- ✅ Initial load cũng check: Task 5 — `checkNeedsOnboarding` path
- ✅ Admin/ke_toan/hr không bị chặn: Task 5 — chỉ `member` và `freelancer` đi qua check
- ✅ DB persistence: Task 1 — `hr_onboarding_acknowledgments` + `onboarding_completed_at`
- ✅ Once completed = always done: Task 2 — `checkOnboardingNeeded` check `onboarding_completed_at`
- ✅ Skip nếu không có bài bắt buộc: Task 4 — `if (articles.length === 0) { onComplete(); return null; }`

**Placeholder scan:** Không có TBD/TODO. Tất cả steps có code.

**Type consistency:**
- `HandbookArticle.is_required` định nghĩa Task 2 → dùng Task 3 (HandbookAdminTab), Task 4 (OnboardingScreen) ✅
- `submitOnboardingAcks(employeeId: string, articleIds: string[])` Task 2 → gọi Task 4 ✅
- `checkOnboardingNeeded(employeeId: string): Promise<boolean>` Task 2 → gọi Task 5 ✅
- `<OnboardingScreen currentUser={AccountUser} onComplete={() => void} />` Task 4 → dùng Task 5 ✅
