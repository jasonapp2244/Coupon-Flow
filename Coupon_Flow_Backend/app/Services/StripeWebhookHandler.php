<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\StripeEvent;
use App\Notifications\AdminActivity;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Stripe\Charge;
use Stripe\Checkout\Session;
use Stripe\Dispute;
use Stripe\Event;

class StripeWebhookHandler
{
    public function __construct(
        private readonly OrderFulfillment $fulfillment,
    ) {}

    /**
     * Process an already signature-verified event exactly once.
     * Returns false when the event had been processed before.
     */
    public function handle(Event $event): bool
    {
        if (StripeEvent::where('event_id', $event->id)->exists()) {
            return false;
        }

        try {
            // Processing and the "seen" marker commit together: if processing throws, Stripe's
            // retry gets another chance; a concurrent duplicate trips the unique index instead.
            DB::transaction(function () use ($event): void {
                $this->dispatch($event);
                StripeEvent::create(['event_id' => $event->id, 'type' => $event->type, 'processed_at' => now()]);
            });
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        return true;
    }

    private function dispatch(Event $event): void
    {
        $object = $event->data->object;

        match ($event->type) {
            'checkout.session.completed',
            'checkout.session.async_payment_succeeded' => $this->onPaymentSucceeded($object),
            'checkout.session.async_payment_failed' => $this->fulfillment->fail($object, OrderStatus::Failed),
            'checkout.session.expired' => $this->fulfillment->fail($object, OrderStatus::Expired),
            'charge.refunded' => $this->onRefunded($object),
            'charge.dispute.created' => $this->onDisputed($object),
            default => null, // Not subscribed to anything else; acknowledge and ignore.
        };
    }

    private function onPaymentSucceeded(Session $session): void
    {
        // "completed" also fires for delayed methods before money arrives; wait for
        // async_payment_succeeded in that case.
        if ($session->payment_status === 'paid') {
            $this->fulfillment->fulfill($session);
        }
    }

    private function onRefunded(Charge $charge): void
    {
        if (! $charge->refunded || ! is_string($charge->payment_intent)) {
            return; // Partial refunds keep the order paid.
        }

        if ($order = Order::where('stripe_payment_intent_id', $charge->payment_intent)->first()) {
            $this->fulfillment->refunded($order);
        }
    }

    private function onDisputed(Dispute $dispute): void
    {
        // The code was already delivered, so there is nothing to revoke: an admin has to respond
        // with evidence in the Stripe Dashboard before the deadline or the money is lost.
        $order = is_string($dispute->payment_intent)
            ? Order::where('stripe_payment_intent_id', $dispute->payment_intent)->first()
            : null;

        $subject = $order ? "Order #{$order->id}" : "Payment {$dispute->payment_intent}";
        AdminActivity::broadcast("{$subject} was disputed by the cardholder ({$dispute->reason}). Respond in the Stripe Dashboard.", 'error_alerts');
    }
}
