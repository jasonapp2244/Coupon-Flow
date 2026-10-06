<?php

namespace App\Http\Resources;

use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Admin view of a coupon: always includes the code.
 * The public site uses PublicCouponResource, which carries no codes or merchant links.
 *
 * @mixin Coupon
 */
class CouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'store_id' => $this->store_id,
            'store' => $this->whenLoaded('store', fn () => $this->store?->name),
            'title' => $this->title,
            'type' => $this->type->value,
            'code' => $this->code,
            'description' => $this->description,
            'tracking_url' => $this->tracking_url,
            // Exact moments (UTC), plus the same in the store's timezone for the admin's inputs.
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'starts_at_local' => Coupon::toLocalInput($this->starts_at),
            'expires_at_local' => Coupon::toLocalInput($this->expires_at),
            'status' => $this->status->value,
            'state' => $this->state(),
            // Imported from a brand feed: which one, and the brand's own id for the coupon.
            'feed_source_id' => $this->feed_source_id,
            'feed_source' => $this->whenLoaded('feedSource', fn () => $this->feedSource?->name),
            'external_id' => $this->external_id,
            'usage_limit' => $this->usage_limit,
            'uses_count' => $this->uses_count,
            'uses_left' => $this->usesLeft(),
            'used_percent' => $this->usedPercent(),
            'is_featured' => $this->is_featured,
            'is_verified' => $this->is_verified,
            'is_exclusive' => $this->is_exclusive,
            'price_cents' => $this->price_cents,
            'currency' => config('services.stripe.currency'),
            'stock' => $this->stock,
            'unique_codes' => $this->unique_codes,
            // Pool counts (edit view). Unsold includes codes held by open checkouts.
            'codes_available' => $this->when(isset($this->codes_available), fn () => (int) $this->codes_available),
            'codes_sold' => $this->when(isset($this->codes_sold), fn () => (int) $this->codes_sold),
            // Units held by unpaid checkouts; they return to stock if those checkouts expire.
            'reserved_stock' => $this->when(isset($this->reserved_stock), fn () => (int) $this->reserved_stock),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
