# Design: BD Role + CRM & Employee Portal Access

_Date: 2026-06-21_
_Status: Approved_

---

## Overview

Add a new `bd` (Business Development) role to the platform. BD employees will see two apps upon login: **CRM** and **Employee Portal**.

---

## Goals

- BD staff can access the CRM app to manage business development activities
- BD staff can use the Employee Portal for self-service HR tasks (payroll view, leave requests)
- No new UI components or database schema changes required
- Consistent with the existing role-based access control pattern

---

## Out of Scope

- Changes to CRM app internals (no BD-specific views within CRM)
- New Supabase tables or RLS policies (role stored in `user_metadata`, not a DB table)
- Access to any other apps (Dashboard, Invoice, HR, Attendance, Payroll, etc.)

---

## Architecture

The platform uses a single-point access control pattern:

1. **Role stored in Supabase Auth** — `user_metadata.role = 'bd'`
2. **Parsed at login** in `App.tsx` via `VALID_ROLES` whitelist
3. **Typed in `types.ts`** — `AccountUser.role` union type
4. **App visibility filtered in `HomeScreen.tsx`** — apps with `roles` array must include the user's role
5. **App registry in `config/apps.ts`** — each app declares which roles can see it

No new components needed. All changes are configuration-level.

---

## File Changes

### 1. `types.ts`

Add `'bd'` to the `AccountUser` role union:

```typescript
// Before
role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer';

// After
role: 'admin' | 'ke_toan' | 'hr' | 'member' | 'freelancer' | 'bd';
```

### 2. `App.tsx`

Add `'bd'` to the `VALID_ROLES` constant so it is accepted at login:

```typescript
// Before
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer'] as const;

// After
const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd'] as const;
```

### 3. `config/apps.ts`

Add `'bd'` to the `roles` array of two apps:

| App ID | Current roles | Updated roles |
|--------|--------------|---------------|
| `crm` | `['admin', 'ke_toan']` | `['admin', 'ke_toan', 'bd']` |
| `portal` | `['member']` | `['member', 'bd']` |

---

## BD Role App Visibility

| App | BD sees? |
|-----|----------|
| CRM | ✅ |
| Employee Portal | ✅ |
| Dashboard | ❌ |
| Invoice / Expense | ❌ |
| HR / Attendance / Payroll | ❌ |
| Accounting / Company | ❌ |
| AI Agent / System Monitor | ❌ |

---

## Risk & Considerations

- **Portal internal role checks:** The Portal app may have `role === 'member'` guards internally. Must audit `apps/portal/` for hardcoded role checks and update them to also allow `'bd'`.
- **CRM RLS policies:** Supabase RLS on CRM-related tables may currently only allow `admin` and `ke_toan`. BD users may get empty data or errors if RLS is not updated. This should be verified after the frontend change.
- **User provisioning:** BD accounts must be created in Supabase Auth with `user_metadata.role = 'bd'` — same process as other roles.

---

## Validation

- `npm run build` must pass with zero TypeScript errors
- Login as a `bd` user and confirm only CRM and Employee Portal appear on HomeScreen
- Verify Portal features (leave, payslip) are accessible to `bd` role

---

## Decision

Chosen approach: **Add `bd` to existing CRM app** (not create a separate CRM app), consistent with how other roles share apps. Simplest, lowest risk, fully leverages existing access control infrastructure.
