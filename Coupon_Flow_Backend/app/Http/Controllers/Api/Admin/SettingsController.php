<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Audit;
use App\Services\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index(SiteSettings $settings): JsonResponse
    {
        $data = collect(SiteSettings::DEFAULTS)->map(fn (array $defaults, string $group) => $settings->group($group));

        // Checkout currency comes from STORE_CURRENCY (Stripe), so it is shown but not editable.
        return response()->json(['data' => $data, 'meta' => ['currency' => strtoupper(config('services.stripe.currency'))]]);
    }

    public function update(Request $request, string $group, SiteSettings $settings): JsonResponse
    {
        abort_unless(isset(SiteSettings::DEFAULTS[$group]), 404);

        $values = $request->validate($this->rules($group));
        $before = $settings->group($group);
        $merged = array_intersect_key(array_merge($before, $values), SiteSettings::DEFAULTS[$group]);

        Setting::updateOrCreate(['key' => $group], ['value' => $merged]);
        $settings->forget();

        $changes = [];
        foreach ($merged as $key => $value) {
            if (($before[$key] ?? null) !== $value) {
                $changes[$key] = [$before[$key] ?? null, $value];
            }
        }
        if ($changes) {
            Audit::log('settings_updated', changes: $changes, label: ucfirst($group).' settings');
        }

        return response()->json(['data' => $settings->group($group)]);
    }

    /** @return array<string, mixed> */
    private function rules(string $group): array
    {
        return match ($group) {
            'general' => [
                'site_name' => ['sometimes', 'string', 'max:120'],
                'support_email' => ['sometimes', 'nullable', 'email', 'max:190'],
                'timezone' => ['sometimes', 'timezone'],
                'shop_enabled' => ['sometimes', 'boolean'],
            ],
            'seo' => [
                'meta_title' => ['sometimes', 'nullable', 'string', 'max:190'],
                'meta_description' => ['sometimes', 'nullable', 'string', 'max:500'],
                'meta_keywords' => ['sometimes', 'nullable', 'string', 'max:500'],
            ],
            'notifications' => array_fill_keys(array_keys(SiteSettings::DEFAULTS['notifications']), ['sometimes', 'boolean']),
            'security' => [
                'require_two_factor' => ['sometimes', 'boolean'],
            ],
        };
    }
}
