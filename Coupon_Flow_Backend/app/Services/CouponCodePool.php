<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Mail\OrderPaidMail;
use App\Models\Coupon;
use App\Models\CouponCode;
use App\Models\Order;
use App\Models\OrderItem;
use App\Notifications\AdminActivity;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Codes for coupons sold with a unique code per buyer.
 *
 * Stock stays the single number checkout reserves against: for these coupons it always equals
 * unsold codes minus the ones held by open checkouts. Checkout, expiry and release therefore work
 * unchanged, and the specific code is only picked when the payment is confirmed.
 */
class CouponCodePool
{
    /**
     * Hands the next unsold code to a paid order line. Must run inside the fulfilment transaction.
     * Null only when the pool ran dry (a payment that arrived after its checkout had expired).
     */
    public function assign(OrderItem $item): ?string
    {
        $code = CouponCode::where('coupon_id', $item->coupon_id)->available()
            ->orderBy('id')->lockForUpdate()->first();

        if ($code === null) {
            return null;
        }

        $code->update(['order_item_id' => $item->id, 'assigned_at' => now()]);
        $item->update(['code_snapshot' => $code->code]);

        return $code->code;
    }

    /**
     * Adds codes, skipping blanks and ones the pool already has. Paid orders still waiting for a
     * code are served first (and emailed); the rest become stock.
     *
     * @param  list<string|null>  $codes
     * @return array{added: int, duplicates: int, delivered: int}
     */
    public function add(Coupon $coupon, array $codes): array
    {
        // Compared case-insensitively, like MariaDB's collation on the unique index: "abc" and "ABC"
        // are one code there, so letting both through would fail the insert.
        $distinct = [];
        foreach ($codes as $code) {
            $code = trim((string) $code);
            if ($code !== '') {
                $distinct[mb_strtolower($code)] ??= $code;
            }
        }

        $result = DB::transaction(function () use ($coupon, $distinct): array {
            $locked = Coupon::whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            $this->assertUsesPool($locked);

            $existing = CouponCode::where('coupon_id', $locked->id)->pluck('code')
                ->mapWithKeys(fn (string $code) => [mb_strtolower($code) => true])->all();
            $new = array_values(array_diff_key($distinct, $existing));

            $now = now();
            foreach (array_chunk($new, 500) as $chunk) {
                CouponCode::insert(array_map(fn (string $code) => [
                    'coupon_id' => $locked->id, 'code' => $code, 'created_at' => $now, 'updated_at' => $now,
                ], $chunk));
            }

            $delivered = [];
            foreach ($this->waitingItems($locked) as $item) {
                if ($this->assign($item) === null) {
                    break;
                }
                $delivered[] = $item->order_id;
            }

            $locked->increment('stock', count($new) - count($delivered));

            return [
                'added' => count($new),
                'duplicates' => count($distinct) - count($new),
                'delivered' => array_values(array_unique($delivered)),
            ];
        });

        foreach (Order::with('items')->whereIn('id', $result['delivered'])->get() as $order) {
            Mail::to($order->email)->queue(new OrderPaidMail($order));
            AdminActivity::broadcast("Order #{$order->id} received its code for \"{$coupon->title}\"");
        }

        return [...$result, 'delivered' => count($result['delivered'])];
    }

    /** Removes an unsold code. Refused when every unsold code is held by an open checkout. */
    public function remove(Coupon $coupon, CouponCode $code): void
    {
        DB::transaction(function () use ($coupon, $code): void {
            $locked = Coupon::whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            $code = CouponCode::whereKey($code->id)->lockForUpdate()->firstOrFail();

            if ($code->order_item_id !== null) {
                throw ValidationException::withMessages(['code' => 'This code was sold and belongs to its buyer.']);
            }
            if ($locked->unique_codes && (int) $locked->stock <= 0) {
                throw ValidationException::withMessages(['code' => 'Every unsold code is held by a shopper who is paying right now. Try again in a few minutes.']);
            }

            $code->delete();
            if ($locked->unique_codes) {
                $locked->decrement('stock');
            }
        });
    }

    /** Stock for a coupon switching to unique codes (only allowed with no open checkouts, so nothing is held). */
    public function stockFor(Coupon $coupon): int
    {
        return CouponCode::where('coupon_id', $coupon->id)->available()->count();
    }

    public function hasOpenCheckouts(Coupon $coupon): bool
    {
        return $coupon->orderItems()->whereHas('order', fn ($q) => $q->where('status', OrderStatus::Pending))->exists();
    }

    /** @return Collection<int, OrderItem> */
    private function waitingItems(Coupon $coupon)
    {
        return OrderItem::where('coupon_id', $coupon->id)
            ->whereNull('code_snapshot')
            ->whereHas('order', fn ($q) => $q->where('status', OrderStatus::Paid))
            ->orderBy('id')
            ->get();
    }

    private function assertUsesPool(Coupon $coupon): void
    {
        if (! $coupon->unique_codes) {
            throw ValidationException::withMessages(['codes' => 'Turn on "Unique code per buyer" for this coupon first.']);
        }
    }
}
