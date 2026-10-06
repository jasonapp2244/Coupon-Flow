<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Coupon;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

/**
 * Stock is taken when checkout starts (so two buyers cannot pay for the last unit)
 * and given back when that checkout fails or expires.
 */
class StockReservation
{
    /** Must run inside the caller's transaction, after the coupons were locked. */
    public function reserve(Order $order): void
    {
        foreach ($order->items as $item) {
            Coupon::whereKey($item->coupon_id)
                ->whereNotNull('stock')
                ->decrement('stock', $item->quantity);
        }
    }

    /**
     * Close a still-pending order with $status and return its reserved stock.
     * A no-op if the order already left "pending" (e.g. it was paid meanwhile).
     */
    public function release(Order $order, OrderStatus $status): void
    {
        DB::transaction(function () use ($order, $status): void {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if ($locked === null || $locked->status !== OrderStatus::Pending) {
                return;
            }

            foreach ($locked->items as $item) {
                Coupon::withTrashed()->whereKey($item->coupon_id)
                    ->whereNotNull('stock')
                    ->increment('stock', $item->quantity);
            }

            $locked->update(['status' => $status]);
        });

        $order->refresh();
    }
}
