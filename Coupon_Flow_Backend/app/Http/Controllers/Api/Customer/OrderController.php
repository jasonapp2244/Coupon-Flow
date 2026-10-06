<?php

namespace App\Http\Controllers\Api\Customer;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\OrderItem;
use App\Services\CheckoutService;
use App\Services\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class OrderController extends Controller
{
    public function checkout(Request $request, CheckoutService $checkout): JsonResponse
    {
        $data = $request->validate([
            'coupon_ids' => ['required', 'array', 'min:1', 'max:20'],
            'coupon_ids.*' => ['integer', 'distinct'],
        ]);

        abort_unless(app(SiteSettings::class)->shopEnabled(), 403, 'Exclusive codes are not on sale right now.');
        abort_unless($request->user()->hasVerifiedEmail(), 403, 'Confirm your email address first: your codes are sent there after payment.');

        $result = $checkout->start($request->user(), array_map('intval', $data['coupon_ids']));

        return response()->json([
            'order_id' => $result['order']->id,
            'checkout_url' => $result['url'],
        ], 201);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        return OrderResource::collection(
            $request->user()->orders()->with('items')->latest()->paginate($this->perPage($request))
        );
    }

    /**
     * Coupons the shopper has paid for, with the order that holds each code, so the public site can
     * show "Bought" instead of "Add to cart". Mirrors the checkout's already-bought rule: refunded
     * orders don't count, so a refunded coupon can be bought again.
     */
    public function purchases(Request $request): JsonResponse
    {
        $rows = OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('user_id', $request->user()->id)->where('status', OrderStatus::Paid))
            ->selectRaw('coupon_id, MAX(order_id) as order_id')
            ->groupBy('coupon_id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (OrderItem $row) => [
                'coupon_id' => (int) $row->coupon_id,
                'order_id' => (int) $row->order_id,
            ])->values(),
        ]);
    }

    /** Lookup by Stripe session id, used by the public site's "payment successful" page. */
    public function bySession(Request $request, string $sessionId): OrderResource
    {
        return new OrderResource(
            $request->user()->orders()->with('items')->where('stripe_checkout_session_id', $sessionId)->firstOrFail()
        );
    }

    /**
     * Shopper backed out of Stripe Checkout: expire the session so the reserved stock is
     * released now (via the checkout.session.expired webhook) instead of after the TTL.
     */
    public function cancel(Request $request, int $order): JsonResponse
    {
        $order = $request->user()->orders()->findOrFail($order);

        if ($order->status !== OrderStatus::Pending || ! $order->stripe_checkout_session_id) {
            return response()->json(['message' => 'This order is no longer open.', 'status' => $order->status->value]);
        }

        try {
            // Resolved only here: closed orders must answer even when Stripe isn't configured.
            app(StripeClient::class)->checkout->sessions->expire($order->stripe_checkout_session_id);
        } catch (ApiErrorException $e) {
            // Usually "already completed or expired" — the webhook / reconcile job settles the order either way.
            Log::info('Could not expire checkout session', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }

        return response()->json(['message' => 'Checkout cancelled. You have not been charged.', 'status' => $order->fresh()->status->value]);
    }

    public function show(Request $request, int $order): OrderResource
    {
        // Scoped through the user's own orders: another customer's order is simply a 404.
        return new OrderResource($request->user()->orders()->with('items')->findOrFail($order));
    }
}
