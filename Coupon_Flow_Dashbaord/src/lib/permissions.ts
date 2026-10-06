import type { StaffRole, User } from './types';

/**
 * What each staff role may do (the API enforces the same rules; this only hides what would fail):
 * - read:  every staff member (viewer, editor, admin)
 * - write: editors and admins: stores, coupons, blogs, categories, feeds (run / import)
 * - admin: admins only: settings, staff, activity log, refunds, feed setup, permanent deletes
 */
export type Permission = 'read' | 'write' | 'admin';

const STAFF: StaffRole[] = ['admin', 'editor', 'viewer'];

export function isStaff(user: Pick<User, 'role'> | null): boolean {
  return !!user && (STAFF as string[]).includes(user.role);
}

export function allows(role: User['role'] | undefined, permission: Permission): boolean {
  switch (permission) {
    case 'read': return role === 'admin' || role === 'editor' || role === 'viewer';
    case 'write': return role === 'admin' || role === 'editor';
    case 'admin': return role === 'admin';
  }
}

export const ROLE_LABELS: Record<StaffRole, { label: string; description: string }> = {
  admin: { label: 'Admin', description: 'Everything, including settings, staff, refunds and the activity log.' },
  editor: { label: 'Editor', description: 'Stores, coupons, blogs and brand feeds. No settings, staff or money.' },
  viewer: { label: 'Viewer', description: 'Read-only: dashboard, lists and reports.' },
};
