<?php

namespace App\Enums;

enum Role: string
{
    case Admin = 'admin';
    /** Staff: manages stores, coupons, blogs and feeds; no settings, money or staff. */
    case Editor = 'editor';
    /** Staff: read-only access to the dashboard and reports. */
    case Viewer = 'viewer';
    case Customer = 'customer';

    /** Roles that may sign in to the admin dashboard. */
    public static function staff(): array
    {
        return [self::Admin, self::Editor, self::Viewer];
    }

    public function isStaff(): bool
    {
        return in_array($this, self::staff(), true);
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
