<?php

namespace App\Models;

use App\Enums\RedemptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Redemption extends Model
{
    protected $fillable = [
        'reference', 'user_name', 'coupon_id', 'coupon_code', 'store_id', 'order_value_cents', 'commission_cents',
        'clicked_at', 'redeemed_at', 'status', 'tracking_id',
    ];

    protected function casts(): array
    {
        return [
            'status' => RedemptionStatus::class,
            'order_value_cents' => 'integer',
            'commission_cents' => 'integer',
            'clicked_at' => 'datetime',
            'redeemed_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class)->withTrashed();
    }
}
