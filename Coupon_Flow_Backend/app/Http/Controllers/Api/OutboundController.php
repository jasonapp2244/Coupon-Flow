<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Store;
use App\Services\ClickOut;
use Illuminate\Http\RedirectResponse;

/**
 * The website's only way out to a merchant. Pages link here, never to the merchant, so
 * affiliate links stay off the public site; this records the click and redirects.
 * A dead link (expired coupon, hidden store) lands back on the site instead of an error page.
 */
class OutboundController extends Controller
{
    public function coupon(int $id, ClickOut $clickOut): RedirectResponse
    {
        $coupon = Coupon::publiclyVisible()->with('store')->find($id);

        // Outside its deal window, used up, or gone: back to the store page, no click recorded.
        if (! $coupon || ! $clickOut->record($coupon, auth('sanctum')->user())) {
            $slug = ($coupon ?? Coupon::with('store')->find($id))?->store?->slug;

            return $this->toSite($slug ? "/stores/{$slug}" : '/');
        }

        return $this->away($clickOut->couponUrl($coupon));
    }

    public function store(string $slug, ClickOut $clickOut): RedirectResponse
    {
        $store = Store::publiclyVisible()->where('slug', $slug)->first();

        return $store ? $this->away($clickOut->storeUrl($store)) : $this->toSite('/stores');
    }

    private function away(string $url): RedirectResponse
    {
        return redirect()->away($url)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'X-Robots-Tag' => 'noindex, nofollow',
        ]);
    }

    private function toSite(string $path): RedirectResponse
    {
        return $this->away(config('services.frontend.public_url').$path);
    }
}
