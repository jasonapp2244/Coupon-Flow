<?php

namespace App\Services;

use App\Enums\RedemptionStatus;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\User;
use App\Notifications\AdminActivity;
use Illuminate\Support\Str;

/**
 * Where a shopper leaving the site goes, and the click record it leaves behind.
 * Merchant links live only here and in the admin: the public site gets our own /go URLs.
 */
class ClickOut
{
    public function couponUrl(Coupon $coupon): string
    {
        return $coupon->tracking_url ?: $this->storeUrl($coupon->store);
    }

    public function storeUrl(Store $store): string
    {
        return $store->tracking_url ?: $store->direct_url;
    }

    /**
     * Uses one of the coupon's uses and records the click. False when the usage limit was
     * reached in the meantime: then nothing is recorded and the shopper must not be sent on.
     */
    public function record(Coupon $coupon, ?User $user): bool
    {
        // One atomic statement, so two shoppers can never both take the last use.
        $taken = Coupon::whereKey($coupon->id)
            ->where(fn ($q) => $q->whereNull('usage_limit')->orWhereColumn('uses_count', '<', 'usage_limit'))
            ->toBase()
            ->increment('uses_count');

        if ($taken === 0) {
            return false;
        }

        Redemption::create([
            'reference' => 'CLK-'.Str::upper(Str::ulid()),
            'user_name' => $user?->name ?? 'Guest',
            'coupon_id' => $coupon->id,
            'coupon_code' => $coupon->isPaid() ? '(exclusive)' : ($coupon->code ?: '(deal)'),
            'store_id' => $coupon->store_id,
            'clicked_at' => now(),
            'status' => RedemptionStatus::Clicked,
        ]);

        $this->alertNearLimit($coupon);

        return true;
    }

    /**
     * One alert when a coupon reaches 80% of its limit and one when it is used up. Each count
     * is reached by exactly one increment, so each alert fires once (until uses are reset).
     */
    private function alertNearLimit(Coupon $coupon): void
    {
        if ($coupon->usage_limit === null) {
            return;
        }

        $uses = (int) Coupon::whereKey($coupon->id)->value('uses_count');
        $limit = $coupon->usage_limit;
        $label = "\"{$coupon->title}\"".($coupon->store ? " ({$coupon->store->name})" : '');

        if ($uses === $limit) {
            AdminActivity::broadcast("Coupon {$label} is used up: all {$limit} uses taken. It is hidden on the website.", 'redemption_alerts');
        } elseif ($uses === (int) ceil($limit * Coupon::NEARLY_USED_UP) && $uses < $limit) {
            AdminActivity::broadcast("Coupon {$label} is nearly used up: {$uses} of {$limit} uses taken.", 'redemption_alerts');
        }
    }
}
