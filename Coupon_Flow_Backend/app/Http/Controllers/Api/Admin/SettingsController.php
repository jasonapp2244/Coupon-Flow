<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\Audit;
use App\Services\SiteSettings;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    public function index(SiteSettings $settings): JsonResponse
    {
        $data = collect(SiteSettings::DEFAULTS)->map(fn (array $defaults, string $group) => $settings->group($group));

        return response()->json(['data' => $data, 'meta' => ['homepage_image_urls' => $this->imageUrls($settings->group('homepage'))]]);
    }

    public function update(Request $request, string $group, SiteSettings $settings): JsonResponse
    {
        abort_unless(isset(SiteSettings::DEFAULTS[$group]), 404);

        $values = $request->validate($this->rules($group));
        if ($group === 'homepage' && array_key_exists('slides', $values)) {
            $values['slides'] = $this->normalizeSlides($values['slides'] ?? []);
        }

        $before = $settings->group($group);
        $merged = array_intersect_key(array_merge($before, $values), SiteSettings::DEFAULTS[$group]);

        Setting::updateOrCreate(['key' => $group], ['value' => $merged]);
        $settings->forget();

        if ($group === 'homepage') {
            // Images the admin replaced or removed are no longer referenced anywhere: delete the files.
            $orphans = array_diff(SiteSettings::homepageImages($before), SiteSettings::homepageImages($merged));
            if ($orphans) {
                Storage::disk('public')->delete(array_values($orphans));
            }
        }

        // The activity log shows old → new as text: slides as a count, images as set / none.
        $readable = fn (string $key, mixed $value) => match (true) {
            $key === 'slides' => count($value ?? []).' '.(count($value ?? []) === 1 ? 'slide' : 'slides'),
            $key === 'hero_image' => $value ? 'image set' : 'none',
            default => $value,
        };
        $changes = [];
        foreach ($merged as $key => $value) {
            if (($before[$key] ?? null) !== $value) {
                $changes[$key] = [$readable($key, $before[$key] ?? null), $readable($key, $value)];
            }
        }
        if ($changes) {
            Audit::log('settings_updated', changes: $changes, label: ucfirst($group).' settings');
        }

        $response = ['data' => $settings->group($group)];
        if ($group === 'homepage') {
            $response['meta'] = ['homepage_image_urls' => $this->imageUrls($response['data'])];
        }

        return response()->json($response);
    }

    /**
     * One home page image (hero background or a slide). The file is only referenced once the
     * admin saves the homepage settings with the returned path.
     */
    public function uploadHomepageImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $path = $request->file('image')->store(SiteSettings::HOMEPAGE_DIR, 'public');

        return response()->json(['data' => ['path' => $path, 'url' => Storage::disk('public')->url($path)]], 201);
    }

    /** @return array<string, mixed> */
    private function rules(string $group): array
    {
        return match ($group) {
            'general' => [
                'site_name' => ['sometimes', 'string', 'max:120'],
                'support_email' => ['sometimes', 'nullable', 'email', 'max:190'],
                'timezone' => ['sometimes', 'timezone'],
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
            'homepage' => [
                'headline' => ['sometimes', 'required', 'string', 'max:140'],
                'subtext' => ['sometimes', 'nullable', 'string', 'max:300'],
                'search_placeholder' => ['sometimes', 'required', 'string', 'max:60'],
                'hero_image' => ['sometimes', 'nullable', 'string', $this->uploadedImage()],
                'slides' => ['sometimes', 'array', 'max:3'],
                'slides.*.image' => ['required', 'string', $this->uploadedImage()],
                'slides.*.title' => ['required', 'string', 'max:120'],
                'slides.*.subtitle' => ['nullable', 'string', 'max:200'],
                'slides.*.button_text' => ['nullable', 'string', 'max:40'],
                // A page on this site ("/stores/nike") or a full web address.
                'slides.*.link' => ['nullable', 'string', 'max:500', 'regex:#^(/(?!/)|https?://)#i'],
            ],
        };
    }

    /** A path returned by the homepage image upload that still exists on the public disk. */
    private function uploadedImage(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) {
            $prefix = SiteSettings::HOMEPAGE_DIR.'/';
            if (! is_string($value) || ! str_starts_with($value, $prefix) || str_contains($value, '..') || ! Storage::disk('public')->exists($value)) {
                $fail('Upload the image again.');
            }
        };
    }

    /**
     * Keeps only the known slide fields, in order, with empty strings stored as null.
     *
     * @param  array<int, array<string, mixed>>  $slides
     * @return list<array<string, string|null>>
     */
    private function normalizeSlides(array $slides): array
    {
        return array_values(array_map(fn (array $slide) => [
            'image' => $slide['image'],
            'title' => $slide['title'],
            'subtitle' => ($slide['subtitle'] ?? '') === '' ? null : $slide['subtitle'],
            'button_text' => ($slide['button_text'] ?? '') === '' ? null : $slide['button_text'],
            'link' => ($slide['link'] ?? '') === '' ? null : $slide['link'],
        ], $slides));
    }

    /**
     * Preview URLs for the admin form, keyed by path.
     *
     * @param  array<string, mixed>  $homepage
     * @return array<string, string>
     */
    private function imageUrls(array $homepage): array
    {
        $urls = [];
        foreach (SiteSettings::homepageImages($homepage) as $path) {
            $urls[$path] = Storage::disk('public')->url($path);
        }

        return $urls;
    }
}
