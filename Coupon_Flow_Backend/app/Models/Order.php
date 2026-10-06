<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'email', 'status', 'total_cents', 'currency',
        'stripe_checkout_session_id', 'stripe_payment_intent_id', 'paid_at', 'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'total_cents' => 'integer',
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Stripe idempotency key for one action on this order. Includes the creation time so a key
     * can never collide with another order that had the same id (database restore, a staging
     * copy sharing the Stripe account); Stripe remembers keys for 24 hours.
     */
    public function idempotencyKey(string $action): string
    {
        return "{$action}-order-{$this->id}-{$this->created_at?->getTimestamp()}";
    }
}
