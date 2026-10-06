<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Mail\OrderPaidMail;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->enableShop();
    }

    private function sessionResponse(array $overrides = []): array
    {
        return array_merge([
            'id' => 'cs_test_123',
            'object' => 'checkout.session',
            'url' => 'https://checkout.stripe.com/c/pay/cs_test_123',
            'status' => 'open',
            'payment_status' => 'unpaid',
        ], $overrides);
    }

    /** Session object as delivered inside a webhook event. */
    private function paidSession(Order $order, array $overrides = []): array
    {
        return array_merge([
            'id' => $order->stripe_checkout_session_id,
            'object' => 'checkout.session',
            'status' => 'complete',
            'payment_status' => 'paid',
            'amount_total' => $order->total_cents,
            'currency' => $order->currency,
            'payment_intent' => 'pi_test_123',
            'metadata' => ['order_id' => (string) $order->id],
        ], $overrides);
    }

    private function startCheckout(User $customer, array $couponIds): Order
    {
        Sanctum::actingAs($customer);
        $id = $this->postJson('/api/v1/checkout', ['coupon_ids' => $couponIds])->assertCreated()->json('order_id');

        return Order::findOrFail($id);
    }

    public function test_checkout_reserves_stock_and_creates_a_stripe_session_with_server_prices(): void
    {
        $stripe = $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $coupon = Coupon::factory()->paid(299, stock: 5)->create();
        $customer = $this->actingAsCustomer();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])
            ->assertCreated()
            ->assertJsonPath('checkout_url', 'https://checkout.stripe.com/c/pay/cs_test_123');

        $this->assertSame(4, $coupon->fresh()->stock);

        $order = Order::sole();
        $this->assertSame(OrderStatus::Pending, $order->status);
        $this->assertSame('cs_test_123', $order->stripe_checkout_session_id);
        $this->assertSame($customer->id, $order->user_id);

        $params = $stripe->requests[0]['params'];
        $this->assertSame('payment', $params['mode']);
        $this->assertSame(299, $params['line_items'][0]['price_data']['unit_amount']);
        $this->assertSame((string) $order->id, $params['metadata']['order_id']);
        $this->assertArrayNotHasKey('payment_method_types', $params);
        $this->assertContains('Idempotency-Key: '.$order->idempotencyKey('checkout'), $stripe->requests[0]['headers']);
    }

    public function test_free_sold_out_and_unavailable_coupons_cannot_be_bought(): void
    {
        $this->fakeStripe();
        $this->actingAsCustomer();

        $free = Coupon::factory()->create();
        $soldOut = Coupon::factory()->paid(299, stock: 0)->create();
        $expired = Coupon::factory()->paid()->expired()->create();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$free->id]])->assertJsonValidationErrors('coupon_ids');
        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$soldOut->id]])->assertJsonValidationErrors('coupon_ids');
        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$expired->id]])->assertJsonValidationErrors('coupon_ids');

        $this->assertSame(0, Order::count());
    }

    public function test_stripe_failure_releases_the_reservation(): void
    {
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', ['error' => ['message' => 'boom', 'type' => 'api_error']], 500);
        $coupon = Coupon::factory()->paid(299, stock: 3)->create();
        $this->actingAsCustomer();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])->assertJsonValidationErrors('checkout');

        $this->assertSame(3, $coupon->fresh()->stock);
        $this->assertSame(OrderStatus::Failed, Order::sole()->status);
    }

    public function test_checkout_without_stripe_keys_returns_503(): void
    {
        config(['services.stripe.secret' => null]);
        $coupon = Coupon::factory()->paid()->create();
        $this->actingAsCustomer();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])->assertStatus(503);
    }

    public function test_paid_webhook_fulfils_the_order_once_and_emails_the_code(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $coupon = Coupon::factory()->paid(499)->create(['code' => 'BBY50']);
        $customer = User::factory()->create();
        $order = $this->startCheckout($customer, [$coupon->id]);

        // Before payment the customer sees no code.
        $this->getJson("/api/v1/orders/{$order->id}")->assertJsonPath('data.items.0.code', null);

        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order), 'evt_paid_1')
            ->assertOk()->assertJson(['duplicate' => false]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order), 'evt_paid_1')
            ->assertOk()->assertJson(['duplicate' => true]);

        $order->refresh();
        $this->assertSame(OrderStatus::Paid, $order->status);
        $this->assertSame('pi_test_123', $order->stripe_payment_intent_id);
        Mail::assertQueued(OrderPaidMail::class, 1);

        $this->getJson("/api/v1/orders/{$order->id}")->assertJsonPath('data.items.0.code', 'BBY50');
        $this->getJson('/api/v1/orders/session/cs_test_123')->assertJsonPath('data.status', 'paid');
    }

    public function test_completed_but_unpaid_session_waits_for_async_payment(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);

        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order, ['payment_status' => 'unpaid']))->assertOk();
        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);

        $this->postStripeEvent('checkout.session.async_payment_succeeded', $this->paidSession($order))->assertOk();
        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
    }

    public function test_amount_mismatch_is_never_fulfilled(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid(499)->create()->id]);

        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order, ['amount_total' => 1]))->assertOk();

        $this->assertSame(OrderStatus::Pending, $order->fresh()->status);
        Mail::assertNothingQueued();
    }

    public function test_expired_session_releases_stock(): void
    {
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $coupon = Coupon::factory()->paid(299, stock: 2)->create();
        $order = $this->startCheckout(User::factory()->create(), [$coupon->id]);
        $this->assertSame(1, $coupon->fresh()->stock);

        $this->postStripeEvent('checkout.session.expired', $this->paidSession($order, ['status' => 'expired', 'payment_status' => 'unpaid']))->assertOk();

        $this->assertSame(OrderStatus::Expired, $order->fresh()->status);
        $this->assertSame(2, $coupon->fresh()->stock);
    }

    public function test_cancel_expires_the_stripe_session_and_webhook_releases_stock(): void
    {
        $stripe = $this->fakeStripe()
            ->respond('POST', '/v1/checkout/sessions/cs_test_123/expire', $this->sessionResponse(['status' => 'expired']))
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $coupon = Coupon::factory()->paid(299, stock: 2)->create();
        $customer = User::factory()->create();
        $order = $this->startCheckout($customer, [$coupon->id]);
        $this->assertSame(1, $coupon->fresh()->stock);

        $this->postJson("/api/v1/orders/{$order->id}/cancel")->assertOk()->assertJsonPath('status', 'pending');
        $this->assertSame('/v1/checkout/sessions/cs_test_123/expire', collect($stripe->requests)->last()['path']);

        // Stripe then sends the expiry event, which releases the reservation.
        $this->postStripeEvent('checkout.session.expired', $this->paidSession($order, ['status' => 'expired', 'payment_status' => 'unpaid']))->assertOk();
        $this->assertSame(2, $coupon->fresh()->stock);

        // Another customer cannot cancel someone else's order.
        Sanctum::actingAs(User::factory()->create());
        $this->postJson("/api/v1/orders/{$order->id}/cancel")->assertNotFound();
    }

    public function test_cancelling_a_closed_order_needs_no_stripe_keys(): void
    {
        config(['services.stripe.secret' => null]);
        $customer = $this->actingAsCustomer();
        $order = Order::factory()->for($customer)->create(['status' => OrderStatus::Paid]);

        $this->postJson("/api/v1/orders/{$order->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'paid');
    }

    public function test_invalid_signature_is_rejected(): void
    {
        $this->fakeStripe();

        $this->postStripeEvent('checkout.session.completed', ['id' => 'cs_x', 'object' => 'checkout.session'], secret: 'whsec_wrong')
            ->assertStatus(400);
    }

    public function test_customers_cannot_see_each_others_orders(): void
    {
        $order = Order::factory()->create();
        $this->actingAsCustomer();

        $this->getJson("/api/v1/orders/{$order->id}")->assertNotFound();
    }

    public function test_admin_refund_calls_stripe_and_webhook_marks_refunded(): void
    {
        Mail::fake();
        $stripe = $this->fakeStripe()
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse())
            ->respond('POST', '/v1/refunds', ['id' => 're_1', 'object' => 'refund', 'status' => 'pending']);
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order))->assertOk();

        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/orders/{$order->id}/refund")->assertStatus(202);
        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
        $this->assertSame('pi_test_123', collect($stripe->requests)->last()['params']['payment_intent']);

        $this->postStripeEvent('charge.refunded', [
            'id' => 'ch_1', 'object' => 'charge', 'refunded' => true, 'payment_intent' => 'pi_test_123',
        ])->assertOk();

        $this->assertSame(OrderStatus::Refunded, $order->fresh()->status);
        $this->getJson("/api/v1/admin/orders/{$order->id}")->assertJsonPath('data.items.0.code', null);
    }

    public function test_immediate_card_refund_marks_the_order_without_waiting_for_the_webhook(): void
    {
        Mail::fake();
        $this->fakeStripe()
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse())
            ->respond('POST', '/v1/refunds', ['id' => 're_1', 'object' => 'refund', 'status' => 'succeeded']);
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order))->assertOk();
        $admin = $this->actingAsAdmin();

        $this->postJson("/api/v1/admin/orders/{$order->id}/refund")->assertOk()->assertJsonPath('status', 'refunded');
        $this->assertSame(OrderStatus::Refunded, $order->fresh()->status);

        // The later webhook changes nothing and does not alert twice.
        $this->postStripeEvent('charge.refunded', [
            'id' => 'ch_1', 'object' => 'charge', 'refunded' => true, 'payment_intent' => 'pi_test_123',
        ])->assertOk();
        $this->assertSame(1, $admin->notifications()->where('data->text', "Order #{$order->id} was refunded")->count());
        $this->postJson("/api/v1/admin/orders/{$order->id}/refund")->assertStatus(422);
    }

    public function test_stripe_idempotency_key_is_unique_beyond_the_order_id(): void
    {
        $stripe = $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);

        $headers = implode("\n", $stripe->requests[0]['headers']);
        $this->assertStringContainsString("Idempotency-Key: checkout-order-{$order->id}-{$order->created_at->getTimestamp()}", $headers);
    }

    public function test_a_coupon_already_bought_cannot_be_bought_again(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $customer = User::factory()->create();
        $coupon = Coupon::factory()->paid()->create(['title' => 'Nike 15%']);
        $order = $this->startCheckout($customer, [$coupon->id]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order))->assertOk();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])
            ->assertUnprocessable()
            ->assertJsonPath('errors.coupon_ids.0', 'You already bought "Nike 15%". Find the code in My orders.');
    }

    public function test_purchases_lists_only_the_shoppers_paid_coupons(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        [$bought, $pending, $refunded] = Coupon::factory()->paid()->count(3)->create();
        $customer = User::factory()->create();

        $paid = $this->startCheckout($customer, [$bought->id]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($paid))->assertOk();
        // Not the shopper's paid coupons: an open checkout, a refunded order, another shopper's order.
        foreach ([[$customer, OrderStatus::Pending, $pending], [$customer, OrderStatus::Refunded, $refunded], [User::factory()->create(), OrderStatus::Paid, $pending]] as [$owner, $status, $coupon]) {
            Order::factory()->for($owner)->create(['status' => $status])
                ->items()->create(['coupon_id' => $coupon->id, 'title_snapshot' => $coupon->title, 'unit_price_cents' => 499, 'quantity' => 1]);
        }

        Sanctum::actingAs($customer);
        $this->getJson('/api/v1/purchases')
            ->assertOk()
            ->assertExactJson(['data' => [['coupon_id' => $bought->id, 'order_id' => $paid->id]]]);

        app('auth')->forgetGuards();
        $this->getJson('/api/v1/purchases')->assertUnauthorized();
    }

    public function test_retrying_checkout_replaces_the_open_one_instead_of_holding_stock_twice(): void
    {
        $stripe = $this->fakeStripe()
            ->respond('POST', '/v1/checkout/sessions/cs_test_123/expire', ['id' => 'cs_test_123', 'object' => 'checkout.session', 'status' => 'expired'])
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse())
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse(['id' => 'cs_test_456']));
        $customer = User::factory()->create();
        $coupon = Coupon::factory()->paid(stock: 5)->create();

        $first = $this->startCheckout($customer, [$coupon->id]);
        $second = $this->startCheckout($customer, [$coupon->id]);

        $this->assertSame(OrderStatus::Expired, $first->fresh()->status);
        $this->assertSame(OrderStatus::Pending, $second->fresh()->status);
        $this->assertSame(4, $coupon->fresh()->stock);
        $this->assertTrue(collect($stripe->requests)->contains('path', '/v1/checkout/sessions/cs_test_123/expire'));
    }

    public function test_a_shopper_cannot_hold_more_than_two_open_checkouts(): void
    {
        $this->fakeStripe()
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse())
            ->respond('POST', '/v1/checkout/sessions', $this->sessionResponse(['id' => 'cs_test_456']));
        $customer = User::factory()->create();
        [$a, $b, $c] = Coupon::factory()->paid(stock: 3)->count(3)->create();

        $this->startCheckout($customer, [$a->id]);
        $this->startCheckout($customer, [$b->id]);

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$c->id]])->assertUnprocessable();
        $this->assertSame(3, $c->fresh()->stock);
    }

    public function test_unverified_email_cannot_check_out(): void
    {
        $this->fakeStripe();
        Sanctum::actingAs(User::factory()->unverified()->create());

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [Coupon::factory()->paid()->create()->id]])
            ->assertForbidden()
            ->assertJsonPath('message', 'Confirm your email address first: your codes are sent there after payment.');
    }

    public function test_dispute_alerts_admins_with_the_order_number(): void
    {
        Mail::fake();
        $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);
        $this->postStripeEvent('checkout.session.completed', $this->paidSession($order))->assertOk();
        $admin = User::factory()->admin()->create();

        $this->postStripeEvent('charge.dispute.created', [
            'id' => 'dp_1', 'object' => 'dispute', 'payment_intent' => 'pi_test_123', 'reason' => 'fraudulent',
        ])->assertOk();

        $this->assertSame(
            "Order #{$order->id} was disputed by the cardholder (fraudulent). Respond in the Stripe Dashboard.",
            $admin->notifications()->first()->data['text'],
        );
        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
    }

    public function test_reconcile_settles_orders_whose_webhook_was_missed(): void
    {
        Mail::fake();
        $stripe = $this->fakeStripe()->respond('POST', '/v1/checkout/sessions', $this->sessionResponse());
        $order = $this->startCheckout(User::factory()->create(), [Coupon::factory()->paid()->create()->id]);
        $order->forceFill(['created_at' => now()->subHours(2)])->save();

        $stripe->respond('GET', '/v1/checkout/sessions/cs_test_123', $this->paidSession($order));

        Artisan::call('orders:reconcile');

        $this->assertSame(OrderStatus::Paid, $order->fresh()->status);
    }
}
