import { supabase } from './supabaseClient';
import { AccountUser } from '@/types';

const VALID_ROLES = ['admin', 'ke_toan', 'hr', 'member', 'freelancer', 'bd'] as const;
type ValidRole = typeof VALID_ROLES[number];
const parseRole = (r: string): ValidRole =>
  VALID_ROLES.includes(r as ValidRole) ? (r as ValidRole) : 'member';

/** Parse secondary_roles from user_metadata (array of valid role strings) */
const parseSecondaryRoles = (raw: unknown): string[] | undefined => {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const valid = raw.filter(r => typeof r === 'string' && VALID_ROLES.includes(r as ValidRole));
  return valid.length > 0 ? valid : undefined;
};

export const loginWithCredentials = async (
  username: string,
  password: string
): Promise<AccountUser> => {
  const email = username.includes('@') ? username : `${username}@tdgames.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Tài khoản hoặc mật khẩu không đúng.');
  const meta = data.user.user_metadata;
  return {
    id: data.user.id,
    username: meta.username || data.user.email?.split('@')[0] || username,
    role: parseRole(meta.role || 'member'),
    secondary_roles: parseSecondaryRoles(meta.secondary_roles),
    employee_id: meta.employee_id || undefined,
  };
};

export const logoutFromAuth = async (): Promise<void> => {
  await supabase.auth.signOut();
};

export const getAuthUser = async (): Promise<AccountUser | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const meta = session.user.user_metadata;
  return {
    id: session.user.id,
    username: meta.username || session.user.email?.split('@')[0] || 'unknown',
    role: parseRole(meta.role || 'member'),
    secondary_roles: parseSecondaryRoles(meta.secondary_roles),
    employee_id: meta.employee_id || undefined,
  };
};
