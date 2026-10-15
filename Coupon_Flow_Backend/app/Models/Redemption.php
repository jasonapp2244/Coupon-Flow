<?php

namespace App\Models;

use App\Enums\RedemptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Redemption extends Model
{
    protected $fillable = [
        'reference', 'user_name', 'coupon_id', 'coupon_code', 'store_id', 'order_value_cents', 'commission_cents',
        'clicked_at', 'redeemed_at', 'status', 'tracking_id', 'claim_token', 'visitor_hash', 'commission_percent',
    ];

    /** Never sent anywhere: they identify a browser's click and a visitor. */
    protected $hidden = ['claim_token', 'visitor_hash'];

    protected function casts(): array
    {
        return [
            'status' => RedemptionStatus::class,
            'order_value_cents' => 'integer',
            'commission_cents' => 'integer',
            'commission_percent' => 'float',
            'clicked_at' => 'datetime',
            'redeemed_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class)->withTrashed();
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class)->withTrashed();
    }
}
