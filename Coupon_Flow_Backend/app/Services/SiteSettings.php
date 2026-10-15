<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Storage;

/**
 * Admin-editable settings (stored as one JSON row per group) merged over their defaults.
 * Read by the admin settings screen, the public site, notifications and date handling.
 */
class SiteSettings
{
    /** @var array<string, array<string, mixed>> group => defaults */
    public const DEFAULTS = [
        'general' => ['site_name' => 'Coupon Follow', 'support_email' => '', 'timezone' => 'America/New_York'],
        'seo' => ['meta_title' => '', 'meta_description' => '', 'meta_keywords' => ''],
        'notifications' => ['email' => true, 'sync_alerts' => true, 'redemption_alerts' => false],
        // require_two_factor: every staff account must set up two-step login before using the admin.
        'security' => ['require_two_factor' => false],
        // The public home page hero. Images are public-disk paths under homepage/; slides: up to 3 of
        // {image, title, subtitle, button_text, link}.
        'homepage' => [
            'headline' => 'Save more at the stores you love.',
            'subtext' => 'Free promo codes and deals from popular brands. Find your store, copy the code, and save at checkout.',
            'search_placeholder' => 'Search a store or brand',
            'hero_image' => null,
            'slides' => [],
        ],
    ];

    /** Folder on the public disk that holds the home page images. */
    public const HOMEPAGE_DIR = 'homepage';

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

    /**
     * Every home page image path in a homepage group (background + slides).
     *
     * @param  array<string, mixed>  $homepage
     * @return list<string>
     */
    public static function homepageImages(array $homepage): array
    {
        $paths = [$homepage['hero_image'] ?? null, ...array_column($homepage['slides'] ?? [], 'image')];

        return array_values(array_filter($paths, 'is_string'));
    }

    /**
     * The homepage group as the public site gets it: image URLs instead of disk paths.
     *
     * @return array<string, mixed>
     */
    public function publicHomepage(): array
    {
        $home = $this->group('homepage');
        $url = fn (?string $path) => $path ? Storage::disk('public')->url($path) : null;

        return [
            'headline' => $home['headline'],
            'subtext' => $home['subtext'],
            'search_placeholder' => $home['search_placeholder'],
            'hero_image_url' => $url($home['hero_image']),
            'slides' => array_map(fn (array $slide) => [
                'image_url' => $url($slide['image'] ?? null),
                'title' => $slide['title'] ?? '',
                'subtitle' => $slide['subtitle'] ?? null,
                'button_text' => $slide['button_text'] ?? null,
                'link' => $slide['link'] ?? null,
            ], $home['slides']),
        ];
    }

    /** Empty until the admin sets one: a no-reply sender address must never be shown as "support". */
    public function supportEmail(): string
    {
        return (string) $this->get('general', 'support_email');
    }
}
