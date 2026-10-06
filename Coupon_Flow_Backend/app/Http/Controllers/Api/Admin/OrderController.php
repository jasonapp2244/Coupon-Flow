<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\Audit;
use App\Services\OrderFulfillment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\ApiErrorException;
use Stripe\StripeClient;

class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Order::query()
            ->with(['user', 'items'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('email', 'like', "%{$term}%")
                ->orWhere('id', (int) $term)));

        $this->applySort($query, $request, ['created_at', 'total_cents', 'paid_at'], 'created_at');

        return OrderResource::collection($query->paginate($this->perPage($request)));
    }

    public function show(Order $order): OrderResource
    {
        return new OrderResource($order->load(['user', 'items']));
    }

    /**
     * Ask Stripe for a full refund. A refund that succeeds at once marks the order right away;
     * otherwise the charge.refunded webhook does it, so the status only changes once Stripe confirms.
     */
    public function refund(Order $order, StripeClient $stripe, OrderFulfillment $fulfillment): JsonResponse
    {
        if ($order->status !== OrderStatus::Paid || ! $order->stripe_payment_intent_id) {
            return response()->json(['message' => 'Only paid orders can be refunded.'], 422);
        }

        try {
            $refund = $stripe->refunds->create(
                ['payment_intent' => $order->stripe_payment_intent_id, 'metadata' => ['order_id' => (string) $order->id]],
                ['idempotency_key' => $order->idempotencyKey('refund')],
            );
        } catch (ApiErrorException $e) {
            Log::error('Stripe refund failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Stripe rejected the refund: '.$e->getMessage()], 502);
        }

        Audit::log('order_refunded', $order, ['amount_cents' => $order->total_cents, 'refund_status' => $refund->status], label: 'Order #'.$order->id);

        // Card refunds usually succeed immediately; slower methods finish via the charge.refunded webhook.
        if ($refund->status === 'succeeded') {
            $fulfillment->refunded($order);

            return response()->json(['message' => 'Refunded.', 'refund_status' => $refund->status, 'status' => OrderStatus::Refunded->value]);
        }

        return response()->json(['message' => 'Refund requested.', 'refund_status' => $refund->status], 202);
    }
}
