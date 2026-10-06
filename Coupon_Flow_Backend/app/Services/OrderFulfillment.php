<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Mail\OrderPaidMail;
use App\Models\Order;
use App\Notifications\AdminActivity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Stripe\Checkout\Session;

class OrderFulfillment
{
    public function __construct(
        private readonly StockReservation $stock,
        private readonly CouponCodePool $pool,
    ) {}

    /**
     * Mark the order paid and hand over the codes. Safe to call more than once.
     */
    public function fulfill(Session $session): void
    {
        $order = $this->orderFor($session);

        if ($order === null) {
            Log::warning('Stripe session has no matching order', ['session' => $session->id]);

            return;
        }

        if ($session->amount_total !== $order->total_cents || strtolower((string) $session->currency) !== $order->currency) {
            // Never hand out codes for an amount we did not charge. Needs a human to look at it.
            Log::critical('Stripe amount/currency mismatch — order not fulfilled', [
                'order_id' => $order->id,
                'expected' => [$order->total_cents, $order->currency],
                'received' => [$session->amount_total, $session->currency],
            ]);
            AdminActivity::broadcast("Order #{$order->id} was paid with an unexpected amount and was not fulfilled. Check it in Stripe.", 'error_alerts');

            return;
        }

        $waiting = [];

        $fulfilled = DB::transaction(function () use ($order, $session, &$waiting): bool {
            $locked = Order::whereKey($order->id)->lockForUpdate()->with('items.coupon')->first();

            // Paid already (duplicate event) or closed: nothing to do. An expired order whose
            // late payment still arrived is honoured: Stripe charged the customer.
            if ($locked->status === OrderStatus::Paid || $locked->status === OrderStatus::Refunded) {
                return false;
            }

            $stockWasReleased = $locked->status !== OrderStatus::Pending;

            foreach ($locked->items as $item) {
                if (! $item->coupon->unique_codes) {
                    $item->update(['code_snapshot' => $item->coupon->code]);
                } elseif ($this->pool->assign($item) === null) {
                    // Only reachable when a payment lands after its checkout expired and the pool
                    // sold out meanwhile: adding codes to the pool delivers this one first.
                    $waiting[] = $item->coupon->title;
                }

                if ($stockWasReleased && $item->coupon->stock !== null) {
                    $item->coupon->stock = max(0, $item->coupon->stock - $item->quantity);
                    $item->coupon->save();
                }
            }

            $locked->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
                'stripe_payment_intent_id' => is_string($session->payment_intent)
                    ? $session->payment_intent
                    : $session->payment_intent?->id,
            ]);

            return true;
        });

        if (! $fulfilled) {
            return;
        }

        foreach ($waiting as $title) {
            AdminActivity::broadcast("Order #{$order->id} is paid but \"{$title}\" has no unused codes left. Add codes to deliver it, or refund the order.", 'error_alerts');
        }

        $order->refresh()->load('items');
        Mail::to($order->email)->queue(new OrderPaidMail($order));
        AdminActivity::broadcast(sprintf('Order #%d paid — %s %s', $order->id, number_format($order->total_cents / 100, 2), strtoupper($order->currency)), 'email');
    }

    public function fail(Session $session, OrderStatus $status): void
    {
        if ($order = $this->orderFor($session)) {
            $this->stock->release($order, $status);
        }
    }

    /**
     * Marks a fully refunded order. Called from the refund request (cards refund synchronously)
     * and from the charge.refunded webhook, so whichever arrives second is a no-op.
     */
    public function refunded(Order $order): void
    {
        $updated = Order::whereKey($order->id)->where('status', OrderStatus::Paid)
            ->update(['status' => OrderStatus::Refunded, 'refunded_at' => now()]);

        if ($updated) {
            AdminActivity::broadcast("Order #{$order->id} was refunded", 'email');
        }
    }

    private function orderFor(Session $session): ?Order
    {
        return Order::where('stripe_checkout_session_id', $session->id)->first()
            ?? Order::find($session->metadata['order_id'] ?? null);
    }
}
