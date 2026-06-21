# BD Role — CRM & Employee Portal Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `bd` (Business Development) role that gives access to the CRM app and Employee Portal.

**Architecture:** Single-point access control — `AccountUser.role` union in `types.ts` is the TypeScript source of truth; `VALID_ROLES` in `App.tsx` gates what is accepted at login; `config/apps.ts` declares which roles see each app. Three targeted file edits, no new components.

**Tech Stack:** React 19, TypeScript, Vite — no test runner configured; build (`npm run build`) is the TypeScript validation gate.

## Global Constraints

- Do NOT modify any component logic or service files — only type definitions and config
- Do NOT create new app components — BD uses existing CRM and Portal apps unchanged
- All three file changes must land in a single commit to avoid a broken intermediate TypeScript state
- `npm run build` must exit with code 0 before the task is considered done

---

### Task 1: Register `bd` role in type system and app registry

**Files:**
- Modify: `types.ts:84`
- Modify: `App.tsx:25`
- Modify: `config/apps.ts:56` (crm roles) and `config/apps.ts:92` (portal roles)

**Interfaces:**
- Produces: `AccountUser['role']` now includes `'bd'`; `parseRole('bd')` returns `'bd'` instead of falling back to `'member'`; CRM and Portal appear in HomeScreen for `bd` users

---

- [ ] **Step 1: Verify current state — confirm exact lines before editing**

  Run:
  ```bash
  grep -n "'admin' | 'ke_toan'" types.ts
  grep -n "VALID_ROLES" App.tsx
  grep -n "roles:" config/apps.ts
  ```

  Expected output (confirm these match before editing):
  ```
  types.ts:84:  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer';
  App.tsx:25:const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer'] as const;
  config/apps.ts:20:    roles: ['admin', 'ke_toan'],       ← dashboard
  config/apps.ts:56:    roles: ['admin', 'ke_toan'],       ← crm
  config/apps.ts:92:    roles: ['member'],                  ← portal
  ```

- [ ] **Step 2: Edit `types.ts` — add `'bd'` to AccountUser role union**

  File: `types.ts`, line 84

  Change:
  ```typescript
  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer';
  ```
  To:
  ```typescript
  role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer' | 'bd';
  ```

- [ ] **Step 3: Edit `App.tsx` — add `'bd'` to VALID_ROLES**

  File: `App.tsx`, line 25

  Change:
  ```typescript
  const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer'] as const;
  ```
  To:
  ```typescript
  const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd'] as const;
  ```

- [ ] **Step 4: Edit `config/apps.ts` — add `'bd'` to CRM app roles**

  File: `config/apps.ts`, the `crm` app entry (currently line 56)

  Change:
  ```typescript
  roles: ['admin', 'ke_toan'],
  ```
  To (this is the `crm` entry — verify by the surrounding `id: 'crm'` line):
  ```typescript
  roles: ['admin', 'ke_toan', 'bd'],
  ```

- [ ] **Step 5: Edit `config/apps.ts` — add `'bd'` to Employee Portal roles**

  File: `config/apps.ts`, the `portal` app entry (currently line 92)

  Change:
  ```typescript
  roles: ['member'],
  ```
  To (verify by surrounding `id: 'portal'` line):
  ```typescript
  roles: ['member', 'bd'],
  ```

- [ ] **Step 6: Run TypeScript build to validate all changes**

  Run:
  ```bash
  npm run build
  ```

  Expected: Build exits with code 0, zero TypeScript errors.
  
  If TypeScript errors appear, the most likely cause is the `parseRole` cast in `App.tsx` line 26 — check that the `as const` array and `AccountUser['role']` union are in sync.

- [ ] **Step 7: Verify portal has no hardcoded role checks that would block BD users**

  Run:
  ```bash
  grep -rn "role.*member\|member.*role" apps/portal/
  ```

  Expected: No matches (or only matches that check `employee_id`, not `role === 'member'`). If any `role === 'member'` checks are found, update them to `role === 'member' || role === 'bd'`.

- [ ] **Step 8: Commit all changes**

  ```bash
  git add types.ts App.tsx config/apps.ts
  git commit -m "feat: add bd role with CRM and Employee Portal access"
  ```

---

## Post-Implementation Notes

**User provisioning (manual step — outside codebase):**
BD employee accounts must be created in Supabase Auth with `user_metadata.role = 'bd'`. If the account also needs Employee Portal features (payslip, leave), set `user_metadata.employee_id = '<hr_employees.id>'`.

**CRM data access (follow-up if needed):**
If BD users see an empty CRM or get permission errors, Supabase RLS policies on `crm_*` tables may be restricted to `admin`/`ke_toan`. Inspect RLS policies via Supabase dashboard and add a policy for `bd` if needed. This is outside the scope of this frontend change.
