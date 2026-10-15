<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Store;
use App\Services\ClickOut;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * The website's only way out to a merchant. Pages link here, never to the merchant, so
 * affiliate links stay off the public site; this records the click and redirects.
 * A dead link (expired coupon, hidden store) lands back on the site instead of an error page.
 */
class OutboundController extends Controller
{
    public function coupon(Request $request, int $id, ClickOut $clickOut): RedirectResponse
    {
        // The usage limit is checked by claim() itself: the pop-up may have taken the last code
        // for this same token a moment before this redirect arrived.
        $coupon = Coupon::publiclyVisible(ignoreUsage: true)->with('store')->find($id);
        $token = $clickOut->validToken($request->query('t'));

        // Outside its deal window, used up, over the visitor's daily code limit, or gone:
        // back to the store page, no click recorded. A token that already has its code still goes through.
        if (! $coupon || ! $clickOut->claim($coupon, $token, $clickOut->visitorHash($request), auth('sanctum')->user())['redemption']) {
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
