<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Stripe\Checkout\Session;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class CheckoutService
{
    /** Tags our sessions in the Stripe Dashboard so this checkout flow can be tracked. */
    private const INTEGRATION_IDENTIFIER = 'couponfollow_web_checkout_qhzmbtrk';

    /** Open checkouts one shopper may hold at once, so nobody can tie up limited stock. */
    private const MAX_OPEN_CHECKOUTS = 2;

    public function __construct(
        private readonly StripeClient $stripe,
        private readonly StockReservation $stock,
    ) {}

    /**
     * Reserve stock, create a pending order and a Stripe Checkout Session for it.
     *
     * @param  list<int>  $couponIds
     * @return array{order: Order, url: string}
     */
    public function start(User $user, array $couponIds): array
    {
        $this->assertNotBoughtBefore($user, $couponIds);
        $this->replaceOpenCheckouts($user, $couponIds);

        if ($user->orders()->where('status', OrderStatus::Pending)->count() >= self::MAX_OPEN_CHECKOUTS) {
            throw ValidationException::withMessages([
                'coupon_ids' => 'You already have an unfinished checkout. Complete or cancel it first, or try again in 30 minutes.',
            ]);
        }

        $order = DB::transaction(function () use ($user, $couponIds): Order {
            $coupons = Coupon::publiclyVisible()
                ->with('store')
                ->whereIn('id', $couponIds)
                ->lockForUpdate()
                ->get();

            $this->assertPurchasable($coupons, $couponIds);

            $order = Order::create([
                'user_id' => $user->id,
                'email' => $user->email,
                'status' => OrderStatus::Pending,
                'total_cents' => $coupons->sum('price_cents'),
                'currency' => config('services.stripe.currency'),
            ]);

            foreach ($coupons as $coupon) {
                $order->items()->create([
                    'coupon_id' => $coupon->id,
                    'title_snapshot' => "{$coupon->store->name}: {$coupon->title}",
                    'unit_price_cents' => $coupon->price_cents,
                    'quantity' => 1,
                ]);
            }

            $this->stock->reserve($order);

            return $order;
        });

        try {
            $session = $this->createSession($order->load('items'));
        } catch (ApiErrorException $e) {
            Log::error('Stripe Checkout Session creation failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
            $this->stock->release($order, OrderStatus::Failed);

            throw ValidationException::withMessages([
                'checkout' => 'Payment could not be started. Please try again in a moment.',
            ]);
        }

        $order->update(['stripe_checkout_session_id' => $session->id]);

        return ['order' => $order, 'url' => $session->url];
    }

    /**
     * Every buyer of a coupon receives the same code, so buying it twice would charge for nothing.
     *
     * @param  list<int>  $couponIds
     */
    private function assertNotBoughtBefore(User $user, array $couponIds): void
    {
        $owned = Coupon::withTrashed()
            ->whereIn('id', $couponIds)
            ->whereHas('orderItems.order', fn ($q) => $q->where('user_id', $user->id)->where('status', OrderStatus::Paid))
            ->pluck('title');

        if ($owned->isNotEmpty()) {
            throw ValidationException::withMessages([
                'coupon_ids' => $owned->map(fn (string $title) => "You already bought \"{$title}\". Find the code in My orders.")->all(),
            ]);
        }
    }

    /**
     * A shopper who left Stripe without paying and tries again gets a fresh session: the old one is
     * expired at Stripe and its reserved stock returned, instead of holding stock twice.
     *
     * @param  list<int>  $couponIds
     */
    private function replaceOpenCheckouts(User $user, array $couponIds): void
    {
        $open = $user->orders()
            ->where('status', OrderStatus::Pending)
            ->whereHas('items', fn ($q) => $q->whereIn('coupon_id', $couponIds))
            ->get();

        foreach ($open as $order) {
            if ($order->stripe_checkout_session_id && ! $this->expireSession($order->stripe_checkout_session_id)) {
                throw ValidationException::withMessages([
                    'coupon_ids' => 'Your earlier payment for this coupon is still being confirmed. Check My orders in a minute.',
                ]);
            }

            $this->stock->release($order, OrderStatus::Expired);
        }
    }

    /** False when the session can no longer be expired because the shopper already paid. */
    private function expireSession(string $sessionId): bool
    {
        try {
            $this->stripe->checkout->sessions->expire($sessionId);

            return true;
        } catch (ApiErrorException) {
            try {
                return $this->stripe->checkout->sessions->retrieve($sessionId)->status !== 'complete';
            } catch (ApiErrorException) {
                return false;
            }
        }
    }

    /**
     * @param  Collection<int, Coupon>  $coupons
     * @param  list<int>  $requestedIds
     */
    private function assertPurchasable(Collection $coupons, array $requestedIds): void
    {
        $errors = [];

        if ($coupons->count() !== count($requestedIds)) {
            $errors[] = 'One or more coupons are no longer available.';
        }

        foreach ($coupons as $coupon) {
            if (! $coupon->isPaid()) {
                $errors[] = "\"{$coupon->title}\" is free — no purchase needed.";
            } elseif (! $coupon->inStock()) {
                $errors[] = "\"{$coupon->title}\" is sold out.";
            }
        }

        if ($errors) {
            throw ValidationException::withMessages(['coupon_ids' => $errors]);
        }
    }

    private function createSession(Order $order): Session
    {
        $publicUrl = config('services.frontend.public_url');

        return $this->stripe->checkout->sessions->create([
            'mode' => 'payment',
            // Prices always come from our database, never from the client.
            'line_items' => $order->items->map(fn ($item) => [
                'price_data' => [
                    'currency' => $order->currency,
                    'unit_amount' => $item->unit_price_cents,
                    'product_data' => ['name' => $item->title_snapshot],
                ],
                'quantity' => $item->quantity,
            ])->all(),
            'customer_email' => $order->email,
            'client_reference_id' => (string) $order->id,
            'metadata' => ['order_id' => (string) $order->id],
            'payment_intent_data' => ['metadata' => ['order_id' => (string) $order->id]],
            'expires_at' => now()->addMinutes(config('services.stripe.session_ttl_minutes'))->timestamp,
            'success_url' => $publicUrl.'/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => $publicUrl.'/checkout/cancel?order='.$order->id,
            'integration_identifier' => self::INTEGRATION_IDENTIFIER,
        ], ['idempotency_key' => $order->idempotencyKey('checkout')]);
    }
}
