import { AccountUser } from '@/types';

/**
 * Get all roles for a user (primary + secondary).
 */
export function getUserRoles(user: AccountUser): string[] {
  const roles = [user.role];
  if (user.secondary_roles?.length) {
    for (const r of user.secondary_roles) {
      if (!roles.includes(r)) roles.push(r);
    }
  }
  return roles;
}

/**
 * Check if user has a specific role (primary or secondary).
 */
export function hasRole(user: AccountUser, role: string): boolean {
  if (user.role === role) return true;
  return user.secondary_roles?.includes(role) ?? false;
}

/**
 * Check if user has ANY of the given roles.
 * Used for app visibility and feature access.
 */
export function hasAnyRole(user: AccountUser, roles: string[]): boolean {
  if (roles.includes(user.role)) return true;
  if (user.secondary_roles?.length) {
    return user.secondary_roles.some(r => roles.includes(r));
  }
  return false;
}
