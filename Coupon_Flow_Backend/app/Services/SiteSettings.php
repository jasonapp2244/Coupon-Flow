<?php

namespace App\Services;

use App\Models\Setting;

/**
 * Admin-editable settings (stored as one JSON row per group) merged over their defaults.
 * Read by the admin settings screen, the public site, notifications and date handling.
 */
class SiteSettings
{
    /** @var array<string, array<string, mixed>> group => defaults */
    public const DEFAULTS = [
        // shop_enabled: sell exclusive (paid) codes with cart, sign-in and card checkout. Off = a plain coupon site.
        'general' => ['site_name' => 'Coupon Follow', 'support_email' => '', 'timezone' => 'America/New_York', 'shop_enabled' => false],
        'seo' => ['meta_title' => '', 'meta_description' => '', 'meta_keywords' => ''],
        'notifications' => ['email' => true, 'sync_alerts' => true, 'redemption_alerts' => false, 'error_alerts' => true],
        // require_two_factor: every staff account must set up two-step login before using the admin.
        'security' => ['require_two_factor' => false],
    ];

    /** @var array<string, array<string, mixed>> */
    private array $cache = [];

    /** @return array<string, mixed> */
    public function group(string $group): array
    {
        return $this->cache[$group] ??= array_intersect_key(
            array_merge(self::DEFAULTS[$group], Setting::where('key', $group)->value('value') ?? []),
            self::DEFAULTS[$group],
        );
    }

    public function get(string $group, string $key): mixed
    {
        return $this->group($group)[$key] ?? null;
    }

    public function forget(): void
    {
        $this->cache = [];
    }

    /** The store's timezone: coupon expiry dates end at midnight here, not UTC. */
    public function timezone(): string
    {
        $tz = (string) $this->get('general', 'timezone');

        return in_array($tz, timezone_identifiers_list(), true) ? $tz : config('app.timezone');
    }

    /** Whether the public site sells exclusive codes. Off: paid coupons are hidden and checkout is closed. */
    public function shopEnabled(): bool
    {
        return (bool) $this->get('general', 'shop_enabled');
    }

    /** Empty until the admin sets one: a no-reply sender address must never be shown as "support". */
    public function supportEmail(): string
    {
        return (string) $this->get('general', 'support_email');
    }
}
