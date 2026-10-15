<?php

namespace App\Http\Resources;

use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Public view of a coupon. It carries no code and no merchant link: the code is shown by the
 * reveal endpoint after the shopper clicks out through /api/go.
 *
 * @mixin Coupon
 */
class PublicCouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->type->value,
            'has_code' => $this->unique_codes || filled($this->code),
            // Each click gets the next code of a list; uses_left is then the codes left.
            'code_list' => $this->unique_codes,
            'description' => $this->description,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_featured' => $this->is_featured,
            'is_verified' => $this->is_verified,
            'is_exclusive' => $this->is_exclusive,
            // "Used 125 times · 375 left". used_count is the old name, kept for one release (cached bundles).
            'uses_count' => $this->uses_count,
            'used_count' => $this->uses_count,
            'usage_limit' => $this->usage_limit,
            'uses_left' => $this->usesLeft(),
            'used_percent' => $this->usedPercent(),
            'store' => $this->whenLoaded('store', fn () => [
                'id' => $this->store->id,
                'name' => $this->store->name,
                'slug' => $this->store->slug,
                'logo_url' => $this->store->logo_path ? Storage::disk('public')->url($this->store->logo_path) : null,
            ]),
        ];
    }
}
