<?php

namespace App\Http\Resources;

use App\Models\Redemption;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Redemption */
class RedemptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'user' => $this->user_name,
            'coupon' => $this->coupon_code,
            'coupon_id' => $this->coupon_id,
            'store_id' => $this->store_id,
            'store' => $this->whenLoaded('store', fn () => $this->store?->name),
            'order_value_cents' => $this->order_value_cents,
            'commission_cents' => $this->commission_cents,
            // The rate used when the sale was confirmed.
            'commission_percent' => $this->commission_percent,
            'clicked_at' => $this->clicked_at?->toIso8601String(),
            'redeemed_at' => $this->redeemed_at?->toIso8601String(),
            'status' => $this->status->value,
            'tracking_id' => $this->tracking_id,
        ];
    }
}
