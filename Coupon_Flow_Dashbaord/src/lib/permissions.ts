import type { StaffRole, User } from './types';

/**
 * What each staff role may do (the API enforces the same rules; this only hides what would fail):
 * - read:  every staff member (viewer, editor, admin, super admin)
 * - write: editors and admins: stores, coupons, blogs, categories, feeds (run / import)
 * - admin: admins and super admins: settings, staff, activity log, feed setup, permanent deletes
 * - owner: super admins only: add, change or switch off super admin accounts
 */
export type Permission = 'read' | 'write' | 'admin' | 'owner';

const STAFF: StaffRole[] = ['super_admin', 'admin', 'editor', 'viewer'];

export function isStaff(user: Pick<User, 'role'> | null): boolean {
  return !!user && (STAFF as string[]).includes(user.role);
}

export function allows(role: User['role'] | undefined, permission: Permission): boolean {
  switch (permission) {
    case 'read': return role === 'super_admin' || role === 'admin' || role === 'editor' || role === 'viewer';
    case 'write': return role === 'super_admin' || role === 'admin' || role === 'editor';
    case 'admin': return role === 'super_admin' || role === 'admin';
    case 'owner': return role === 'super_admin';
  }
}

export const ROLE_LABELS: Record<StaffRole, { label: string; description: string }> = {
  super_admin: { label: 'Super Admin', description: 'Everything an admin can do, and the only role that can add or change super admins.' },
  admin: { label: 'Admin', description: 'Everything, including settings, staff and the activity log. Cannot change super admins.' },
  editor: { label: 'Editor', description: 'Stores, coupons, blogs and brand feeds. No settings or staff.' },
  viewer: { label: 'Viewer', description: 'Read-only: dashboard, lists and reports.' },
};
