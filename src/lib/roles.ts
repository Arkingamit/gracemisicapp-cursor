import type { UserRole } from '@/lib/types';

/** Privilege order for deriving a single primary `role` (JWT / legacy checks). */
const ROLE_RANK: Record<UserRole, number> = {
  user: 1,
  manager: 2,
  verifier: 3,
  editor: 4,
  super_admin: 5,
};

export const ASSIGNABLE_SYSTEM_ROLES: {
  key: UserRole;
  label: string;
  description: string;
}[] = [
  { key: 'user', label: 'User', description: 'Standard account' },
  { key: 'verifier', label: 'Verifier', description: 'Review pending global songs' },
  { key: 'editor', label: 'Editor', description: 'Edit & manage global library' },
  { key: 'super_admin', label: 'Super Admin', description: 'Full system access' },
];

export type RoleBearer = {
  role?: string | null;
  roles?: string[] | null;
};

/** Normalize to a unique list of roles (falls back to legacy single `role`). */
export function normalizeRoles(user: RoleBearer | null | undefined): UserRole[] {
  if (!user) return ['user'];

  const fromArray = (user.roles || [])
    .filter((r): r is UserRole => typeof r === 'string' && r in ROLE_RANK);

  if (fromArray.length > 0) {
    return Array.from(new Set(fromArray));
  }

  if (user.role && user.role in ROLE_RANK) {
    return [user.role as UserRole];
  }

  return ['user'];
}

/** Highest-privilege role for JWT / legacy single-role field. */
export function derivePrimaryRole(roles: UserRole[]): UserRole {
  if (!roles.length) return 'user';
  return roles.reduce((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), roles[0]);
}

/**
 * True if the user has any of the listed roles.
 * `super_admin` always matches (full access).
 */
export function hasAnyRole(user: RoleBearer | null | undefined, ...allowed: UserRole[]): boolean {
  const roles = normalizeRoles(user);
  if (roles.includes('super_admin')) return true;
  return allowed.some((r) => roles.includes(r));
}

/** Sanitize incoming role lists from the admin UI. */
export function sanitizeRolesInput(input: unknown): UserRole[] {
  if (!Array.isArray(input)) return ['user'];

  const valid = input.filter((r): r is UserRole => typeof r === 'string' && r in ROLE_RANK);
  const unique = Array.from(new Set(valid));

  // Super admin is exclusive
  if (unique.includes('super_admin')) {
    return ['super_admin'];
  }

  if (unique.length === 0) return ['user'];

  // Always keep at least user if only capability roles? Prefer explicit list as given,
  // but ensure we never store an empty set.
  return unique;
}
