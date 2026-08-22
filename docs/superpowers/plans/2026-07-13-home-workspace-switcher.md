# Home Workspace Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace (sổ TD Games / TD Consulting) switcher directly on `HomeScreen`, reusing the same `useWorkspace()` global state already wired through `Navbar`.

**Architecture:** Extract the existing `<select>`-based switcher out of `Navbar.tsx` into a new shared component `WorkspaceSwitcher.tsx` with two visual variants — `compact` (unchanged `<select>`, used in `Navbar`) and `pill` (new segmented 2-button toggle, used in `HomeScreen`). Both variants read/write `useWorkspace()` internally; callers only pass `variant` (+ `theme` for compact) and keep the existing `hasAnyRole` gate themselves.

**Tech Stack:** React 19 + TypeScript, Tailwind (inline classes), no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-13-home-workspace-switcher-design.md` — 3 files only, no `WorkspaceContext.tsx` changes, no migration, no behavior change to data filtering.
- Role gate stays `hasAnyRole(currentUser, ['admin', 'ke_toan', 'hr'])` in both call sites (not inside `WorkspaceSwitcher` itself — the component takes no user prop).
- No unit-test framework exists in this repo (`package.json` scripts: `dev`, `build`, `lint` = `tsc --noEmit` only — no jest/vitest, no `*.test.*` files found). Per-task "test" step below is `npm run build` (the project's actual required gate per `CLAUDE.md`), plus a final manual UI verification pass — this replaces automated TDD steps, not a skipped step.
- Follow `.agent/meta/STYLE_GUIDE.md` conventions already used in this codebase (`bg-surface`, `border-white/10`, `font-black uppercase tracking-wider`) — no new patterns invented.
- Colors for the `pill` variant must match the existing role-badge convention already in `HomeScreen.tsx:41` (`bg-primary/20 text-primary` vs `bg-blue-500/20 text-blue-400`) — verified against current code, not new.

---

### Task 1: Create `WorkspaceSwitcher.tsx`

**Files:**
- Create: `components/WorkspaceSwitcher.tsx`

**Interfaces:**
- Consumes: `useWorkspace()` and `Workspace` type from `@/services/WorkspaceContext` (existing, unchanged — `workspace: Workspace`, `setWorkspace: (w: Workspace) => void`, `Workspace = 'TD GAMES' | 'TD CONSULTING'`).
- Produces: `WorkspaceSwitcher: React.FC<{ variant?: 'compact' | 'pill'; theme?: string }>` (named export) — consumed by Task 2 (`Navbar.tsx`) and Task 3 (`HomeScreen.tsx`).

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { useWorkspace, Workspace } from '@/services/WorkspaceContext';

const WS_DOT: Record<Workspace, string> = { 'TD GAMES': 'bg-primary', 'TD CONSULTING': 'bg-blue-400' };
const WS_LABEL: Record<Workspace, string> = { 'TD GAMES': 'TD Games', 'TD CONSULTING': 'TD Consulting' };

interface WorkspaceSwitcherProps {
  variant?: 'compact' | 'pill';
  theme?: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ variant = 'compact', theme = 'dark' }) => {
  const { workspace, setWorkspace } = useWorkspace();

  if (variant === 'pill') {
    return (
      <div className="flex items-center gap-1 bg-surface/60 border border-white/10 rounded-full p-1">
        {(['TD GAMES', 'TD CONSULTING'] as Workspace[]).map(w => (
          <button
            key={w}
            type="button"
            onClick={() => setWorkspace(w)}
            title="Chọn sổ sách"
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
              workspace === w
                ? w === 'TD GAMES'
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-blue-500/20 border-blue-400 text-blue-400'
                : 'text-white/40 border-transparent'
            }`}
          >
            {WS_LABEL[w]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center gap-1.5 ${theme === 'dark' ? 'bg-surface border border-white/10' : 'bg-gray-100 border border-gray-200'} rounded-lg px-2 py-1`}>
      <span className={`w-2 h-2 rounded-full ${WS_DOT[workspace]}`} />
      <select
        value={workspace}
        onChange={e => setWorkspace(e.target.value as Workspace)}
        className={`bg-transparent text-[10px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'} outline-none cursor-pointer appearance-none pr-4`}
        title="Chọn sổ sách"
      >
        <option value="TD GAMES" className="bg-[#1a1a1a]">Sổ TD Games</option>
        <option value="TD CONSULTING" className="bg-[#1a1a1a]">Sổ TD Consulting</option>
      </select>
    </div>
  );
};
```

This is a byte-for-byte behavior copy of the `compact` branch (same classes, same dot, same `<select>`) — no visual change to `Navbar`. The `pill` branch is new, per spec section 1.

- [ ] **Step 2: Verify it compiles standalone**

Run: `npm run build`
Expected: PASS, 0 TypeScript errors (the file is not imported anywhere yet, so this only checks the new file's own syntax/types — `tsc` still type-checks unreferenced files in this project since there's no `include` narrowing that excludes it).

- [ ] **Step 3: Commit**

```bash
git add components/WorkspaceSwitcher.tsx
git commit -m "feat: extract WorkspaceSwitcher component with compact/pill variants"
```

---

### Task 2: Wire `WorkspaceSwitcher` into `Navbar.tsx`

**Files:**
- Modify: `components/Navbar.tsx:5` (import), `components/Navbar.tsx:24` (remove now-unused hook call), `components/Navbar.tsx:26` (remove now-unused `WS_DOT` const), `components/Navbar.tsx:116-130` (replace inline switcher block)

**Interfaces:**
- Consumes: `WorkspaceSwitcher` from Task 1 (`import { WorkspaceSwitcher } from './WorkspaceSwitcher';`).
- Produces: nothing new — `Navbar`'s public props/behavior are unchanged.

- [ ] **Step 1: Remove the now-unused `useWorkspace`/`Workspace` import**

In `components/Navbar.tsx`, change line 5 from:

```tsx
import { useWorkspace, Workspace } from '@/services/WorkspaceContext';
```

to:

```tsx
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
```

- [ ] **Step 2: Remove the now-unused hook call and `WS_DOT` const**

In `components/Navbar.tsx`, inside `Navbar`'s function body, delete these two lines (currently lines 24 and 26):

```tsx
  const { workspace, setWorkspace } = useWorkspace();
```

```tsx
  const WS_DOT: Record<string, string> = { 'TD GAMES': 'bg-primary', 'TD CONSULTING': 'bg-blue-400' };
```

(`hasAnyRole` import on line 3 stays — still used for the gate below and elsewhere in the file.)

- [ ] **Step 3: Replace the inline switcher JSX**

Replace this block (currently lines 116-130):

```tsx
        {/* Workspace Switcher */}
        {hasAnyRole(currentUser, ['admin', 'ke_toan', 'hr']) && (
          <div className={`relative flex items-center gap-1.5 ${theme === 'dark' ? 'bg-surface border border-white/10' : 'bg-gray-100 border border-gray-200'} rounded-lg px-2 py-1`}>
            <span className={`w-2 h-2 rounded-full ${WS_DOT[workspace]}`} />
            <select
              value={workspace}
              onChange={e => setWorkspace(e.target.value as Workspace)}
              className={`bg-transparent text-[10px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'} outline-none cursor-pointer appearance-none pr-4`}
              title="Chọn sổ sách"
            >
              <option value="TD GAMES" className="bg-[#1a1a1a]">Sổ TD Games</option>
              <option value="TD CONSULTING" className="bg-[#1a1a1a]">Sổ TD Consulting</option>
            </select>
          </div>
        )}
```

with:

```tsx
        {/* Workspace Switcher */}
        {hasAnyRole(currentUser, ['admin', 'ke_toan', 'hr']) && (
          <WorkspaceSwitcher variant="compact" theme={theme} />
        )}
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: PASS, 0 TypeScript errors, no "declared but never used" warnings for `useWorkspace`/`Workspace`/`WS_DOT` (they're fully removed, not just unused).

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx
git commit -m "refactor: Navbar uses shared WorkspaceSwitcher (compact variant)"
```

---

### Task 3: Add `WorkspaceSwitcher` (pill) to `HomeScreen.tsx`

**Files:**
- Modify: `components/HomeScreen.tsx:1-5` (imports), `components/HomeScreen.tsx:33-49` (header)

**Interfaces:**
- Consumes: `WorkspaceSwitcher` from Task 1 (`import { WorkspaceSwitcher } from './WorkspaceSwitcher';`), `hasAnyRole` from `@/utils/roleUtils` (already imported in this file at line 5 — no change needed there).
- Produces: nothing new — `HomeScreen`'s public props are unchanged.

- [ ] **Step 1: Add the import**

In `components/HomeScreen.tsx`, after the existing imports (after line 5, `import { hasRole, hasAnyRole, getUserRoles } from '@/utils/roleUtils';`), add:

```tsx
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
```

- [ ] **Step 2: Insert the pill switcher into the header**

The header (currently lines 33-49) already has `relative` on its own className — no change needed there (verified against current code; the spec's mention of "thêm relative" was already satisfied). Insert the switcher as an absolutely-centered sibling between the logo block and the user-info block. Change:

```tsx
      {/* Top bar */}
      <header className="relative z-10 h-16 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">TD GAMES Platform</span>
        </div>
        <div className="flex items-center gap-3">
```

to:

```tsx
      {/* Top bar */}
      <header className="relative z-10 h-16 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src="https://pub-f0ef2ac3b67c4d4da2fe20c73ab57f83.r2.dev/logo_td.png" alt="Logo" className="w-8 h-8 object-contain" />
          <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">TD GAMES Platform</span>
        </div>
        {hasAnyRole(currentUser, ['admin', 'ke_toan', 'hr']) && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block">
            <WorkspaceSwitcher variant="pill" />
          </div>
        )}
        <div className="flex items-center gap-3">
```

(the closing `</div>` and rest of the header, lines ~42-49, are untouched)

Note: `hidden sm:block` is added defensively — the spec doesn't call out mobile behavior, but without it the pill (min ~180px wide, absolutely centered) can overlap the logo/user-info blocks on narrow screens (<640px) where `header` padding drops to `px-6`. This is a minimal, spec-compatible safety net (single Tailwind breakpoint utility, no new logic), not a scope expansion. Flag to sếp during manual verification in case a different breakpoint is preferred.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: PASS, 0 TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add components/HomeScreen.tsx
git commit -m "feat: add workspace pill switcher to HomeScreen header"
```

---

### Task 4: Manual verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server and check both switchers live**

Run: `npm run dev` (or use the `/verify` skill if available), open `http://localhost:3000`.

Check, logged in as an `admin` or `ke_toan` or `hr` user:
- `HomeScreen`: pill switcher appears centered in the header (desktop width), clicking "TD Consulting" highlights it blue and de-highlights "TD Games"; clicking back works.
- Navigate into any app with a `Navbar` (e.g. `#invoice`): the compact `<select>` switcher looks and behaves identically to before this change, and reflects the same workspace chosen on `HomeScreen` (shared global state — no reload needed).
- Resize to a narrow/mobile viewport: pill switcher hides cleanly (`hidden sm:block`), no overlap with logo or user info.

Check, logged in as a `member` or `freelancer` user:
- No switcher visible anywhere (gate unchanged).

- [ ] **Step 2: Update project memory**

Per `CLAUDE.md` Memory Protocol — append a dated entry to `.agent/meta/LOG.md` describing the change + validation, and move this task from `Doing` to `Done (mới)` in `.agent/meta/TASKS.md`.

---

## Self-Review

**Spec coverage:**
- §1 "Tách WorkspaceSwitcher.tsx" (compact/pill variants, colors, no external props except `variant`) → Task 1. ✅
- §2 "Vị trí trên HomeScreen" (absolute centered in existing `relative` header) → Task 3. ✅
- §3 "Quyền xem" (`hasAnyRole(['admin','ke_toan','hr'])` at both call sites) → Task 2 Step 3, Task 3 Step 2. ✅
- Scope table (3 files, no `WorkspaceContext.tsx` change) → Tasks 1-3 touch exactly `WorkspaceSwitcher.tsx` (new), `Navbar.tsx`, `HomeScreen.tsx`; no other file modified. ✅
- "Ngoài phạm vi" (no role changes, no new animation beyond existing `transition-all`) → respected; `pill` buttons use `transition-all` only, same pattern as rest of codebase. ✅

**Placeholder scan:** no TBD/TODO, no "add appropriate X", every step has literal code or an exact command with expected output.

**Type consistency:** `WorkspaceSwitcherProps` (`variant?: 'compact' | 'pill'; theme?: string`) defined once in Task 1, used identically in Task 2 (`variant="compact" theme={theme}`) and Task 3 (`variant="pill"`, no `theme` — pill has no light-mode need since `HomeScreen` is always dark). `Workspace` type/`useWorkspace()` signature unchanged from `services/WorkspaceContext.tsx` (verified against current file, not assumed).
