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
            // Code list: usage_limit is the number of codes and uses_count the codes handed out.
            'unique_codes' => $this->unique_codes,
            'codes_total' => $this->unique_codes ? (int) $this->usage_limit : 0,
            'codes_left' => $this->unique_codes ? (int) $this->usesLeft() : 0,
            'max_codes_per_visitor' => $this->max_codes_per_visitor,
            'commission_percent' => $this->commission_percent,
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
