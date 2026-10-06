<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One code in a paid coupon's pool; each is sold to exactly one buyer. */
class CouponCode extends Model
{
    protected $fillable = ['coupon_id', 'code', 'order_item_id', 'assigned_at'];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime'];
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class)->withTrashed();
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function scopeAvailable(Builder $query): void
    {
        $query->whereNull('order_item_id');
    }
}
