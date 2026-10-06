<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StripeWebhookHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;
use UnexpectedValueException;

class StripeWebhookController extends Controller
{
    public function __invoke(Request $request, StripeWebhookHandler $handler): JsonResponse
    {
        $secret = config('services.stripe.webhook_secret');

        if (blank($secret)) {
            Log::error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.');

            return response()->json(['message' => 'Webhook not configured.'], 503);
        }

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                (string) $request->header('Stripe-Signature'),
                $secret,
            );
        } catch (UnexpectedValueException|SignatureVerificationException $e) {
            Log::warning('Rejected Stripe webhook', ['reason' => $e->getMessage()]);

            return response()->json(['message' => 'Invalid payload or signature.'], 400);
        }

        $processed = $handler->handle($event);

        return response()->json(['received' => true, 'duplicate' => ! $processed]);
    }
}
