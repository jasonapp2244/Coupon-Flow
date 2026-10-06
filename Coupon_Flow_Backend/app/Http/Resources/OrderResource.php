<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Codes are only handed out for paid orders; a refund takes them away again.
        $showCodes = $this->status === OrderStatus::Paid;

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'email' => $this->email,
            'customer' => $this->whenLoaded('user', fn () => $this->user?->name),
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at?->toIso8601String(),
            'refunded_at' => $this->refunded_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'coupon_id' => $item->coupon_id,
                'title' => $item->title_snapshot,
                'unit_price_cents' => $item->unit_price_cents,
                'quantity' => $item->quantity,
                'code' => $showCodes ? $item->code_snapshot : null,
                // Paid, but its unique code is still to come (the pool ran out; adding codes delivers it).
                'code_pending' => $showCodes && $item->code_snapshot === null,
            ])),
        ];
    }
}
