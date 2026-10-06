<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Services\OrderFulfillment;
use App\Services\StockReservation;
use Illuminate\Console\Command;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

/**
 * Safety net for missed webhooks: asks Stripe for the real state of stale pending orders.
 */
class ReconcilePendingOrders extends Command
{
    protected $signature = 'orders:reconcile';

    protected $description = 'Settle pending orders whose Stripe Checkout Session has already finished';

    public function handle(OrderFulfillment $fulfillment, StockReservation $stock): int
    {
        if (blank(config('services.stripe.secret'))) {
            $this->info('Stripe is not configured; nothing to reconcile.');

            return self::SUCCESS;
        }

        $stripe = app(StripeClient::class);
        $cutoff = now()->subMinutes(config('services.stripe.session_ttl_minutes') + 10);

        $orders = Order::where('status', OrderStatus::Pending)->where('created_at', '<', $cutoff)->get();

        foreach ($orders as $order) {
            if (! $order->stripe_checkout_session_id) {
                // Session was never created (Stripe was unreachable at checkout).
                $stock->release($order, OrderStatus::Failed);

                continue;
            }

            try {
                $session = $stripe->checkout->sessions->retrieve($order->stripe_checkout_session_id);
            } catch (ApiErrorException $e) {
                $this->warn("Order #{$order->id}: {$e->getMessage()}");

                continue;
            }

            match (true) {
                $session->payment_status === 'paid' => $fulfillment->fulfill($session),
                $session->status === 'expired' => $fulfillment->fail($session, OrderStatus::Expired),
                default => null, // Still open, or completed with a delayed payment in flight.
            };
        }

        $this->info("Checked {$orders->count()} pending order(s).");

        return self::SUCCESS;
    }
}
