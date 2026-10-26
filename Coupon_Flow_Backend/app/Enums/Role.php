<?php

namespace App\Enums;

enum Role: string
{
    /** Owner: everything an admin can do, and the only role that may grant or change super admin. */
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    /** Staff: manages stores, coupons, blogs and feeds; no settings, money or staff. */
    case Editor = 'editor';
    /** Staff: read-only access to the dashboard and reports. */
    case Viewer = 'viewer';
    case Customer = 'customer';

    /** Roles that may sign in to the admin dashboard. */
    public static function staff(): array
    {
        return [self::SuperAdmin, self::Admin, self::Editor, self::Viewer];
    }

    /** Roles with full admin rights (settings, staff, permanent deletes). */
    public static function admins(): array
    {
        return [self::SuperAdmin, self::Admin];
    }

    public function isStaff(): bool
    {
        return in_array($this, self::staff(), true);
    }

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }
}
