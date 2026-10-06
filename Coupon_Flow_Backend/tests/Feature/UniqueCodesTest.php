<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Mail\OrderPaidMail;
use App\Models\Coupon;
use App\Models\CouponCode;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Support\FakeStripeHttpClient;
use Tests\TestCase;

class UniqueCodesTest extends TestCase
{
    use RefreshDatabase;

    private FakeStripeHttpClient $stripe;

    protected function setUp(): void
    {
        parent::setUp();
        $this->enableShop();
        Mail::fake();
        $this->stripe = $this->fakeStripe();
        foreach (range(1, 4) as $n) {
            $this->stripe->respond('POST', '/v1/checkout/sessions', [
                'id' => "cs_test_{$n}", 'object' => 'checkout.session', 'status' => 'open', 'payment_status' => 'unpaid',
                'url' => "https://checkout.stripe.com/c/pay/cs_test_{$n}",
            ]);
        }
    }

    private function buy(User $customer, Coupon $coupon): Order
    {
        Sanctum::actingAs($customer);
        $id = $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])->assertCreated()->json('order_id');

        return Order::findOrFail($id);
    }

    private function pay(Order $order): void
    {
        $this->postStripeEvent('checkout.session.completed', [
            'id' => $order->stripe_checkout_session_id, 'object' => 'checkout.session', 'status' => 'complete',
            'payment_status' => 'paid', 'amount_total' => $order->total_cents, 'currency' => $order->currency,
            'payment_intent' => 'pi_'.$order->id, 'metadata' => ['order_id' => (string) $order->id],
        ])->assertOk();
    }

    public function test_each_buyer_gets_their_own_code_and_stock_follows_the_pool(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['NIKE-A1', 'NIKE-B2', 'NIKE-C3'])->create();
        [$ann, $bob] = User::factory()->count(2)->create();

        $first = $this->buy($ann, $coupon);
        $this->assertSame(2, $coupon->fresh()->stock);
        $this->pay($first);
        $second = $this->buy($bob, $coupon);
        $this->pay($second);

        $this->assertSame('NIKE-A1', $first->items()->first()->code_snapshot);
        $this->assertSame('NIKE-B2', $second->items()->first()->code_snapshot);
        $this->assertSame(1, $coupon->fresh()->stock);
        $this->assertSame(1, CouponCode::available()->count());

        Sanctum::actingAs($bob);
        $this->getJson("/api/v1/orders/{$second->id}")
            ->assertJsonPath('data.items.0.code', 'NIKE-B2')
            ->assertJsonPath('data.items.0.code_pending', false);
        Mail::assertQueued(OrderPaidMail::class, fn (OrderPaidMail $mail) => $mail->hasTo($ann->email) && $mail->order->items->first()->code_snapshot === 'NIKE-A1');

        // The public site never sees pool codes.
        $this->getJson("/api/v1/public/coupons/{$coupon->id}")->assertJsonPath('data.code', null);
    }

    public function test_the_last_code_sells_out_and_an_expired_checkout_returns_it(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['ONLY-ONE'])->create();
        $order = $this->buy(User::factory()->create(), $coupon);

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$coupon->id]])->assertUnprocessable();

        $this->postStripeEvent('checkout.session.expired', ['id' => $order->stripe_checkout_session_id, 'object' => 'checkout.session', 'metadata' => ['order_id' => (string) $order->id]])->assertOk();
        $this->assertSame(1, $coupon->fresh()->stock);
        $this->assertNull(CouponCode::sole()->order_item_id);
    }

    public function test_a_late_payment_after_sell_out_waits_for_new_codes_and_gets_emailed(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['FIRST'])->create(['title' => 'Nike 20%']);
        $late = $this->buy(User::factory()->create(), $coupon);
        $this->postStripeEvent('checkout.session.expired', ['id' => $late->stripe_checkout_session_id, 'object' => 'checkout.session', 'metadata' => ['order_id' => (string) $late->id]])->assertOk();
        $this->pay($this->buy(User::factory()->create(), $coupon)); // someone else buys the last code
        $admin = User::factory()->admin()->create();

        $this->pay($late->fresh()); // Stripe still charged the first shopper

        $this->assertSame(OrderStatus::Paid, $late->fresh()->status);
        $this->assertNull($late->items()->first()->code_snapshot);
        $this->assertSame(0, $coupon->fresh()->stock);
        $this->assertTrue($admin->notifications()->where('data->text', "Order #{$late->id} is paid but \"Nike 20%\" has no unused codes left. Add codes to deliver it, or refund the order.")->exists());
        Sanctum::actingAs($late->user);
        $this->getJson("/api/v1/orders/{$late->id}")->assertJsonPath('data.items.0.code', null)->assertJsonPath('data.items.0.code_pending', true);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => ['NEW-1', 'NEW-2']])
            ->assertCreated()
            ->assertExactJson(['added' => 2, 'duplicates' => 0, 'delivered' => 1, 'stock' => 1]);

        $this->assertSame('NEW-1', $late->items()->first()->code_snapshot);
        Mail::assertQueued(OrderPaidMail::class, fn (OrderPaidMail $mail) => $mail->order->id === $late->id && $mail->order->items->first()->code_snapshot === 'NEW-1');
    }

    public function test_admin_adds_lists_and_removes_codes(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['OLD-1'])->create();
        $this->actingAsAdmin();

        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => [' A-1 ', 'A-2', 'a-2', '', 'old-1']])
            ->assertCreated()
            ->assertExactJson(['added' => 2, 'duplicates' => 1, 'delivered' => 0, 'stock' => 3]);
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => [str_repeat('x', 101)]])->assertJsonValidationErrors('codes.0');

        $this->pay($this->buy(User::factory()->create(), $coupon));
        $this->actingAsAdmin();

        $this->getJson("/api/v1/admin/coupons/{$coupon->id}/codes?status=sold")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.code', 'OLD-1')->assertJsonPath('data.0.status', 'sold');
        $this->getJson("/api/v1/admin/coupons/{$coupon->id}/codes?q=A-")->assertJsonCount(2, 'data');
        $this->getJson("/api/v1/admin/coupons/{$coupon->id}")
            ->assertJsonPath('data.unique_codes', true)->assertJsonPath('data.codes_available', 2)->assertJsonPath('data.codes_sold', 1);
        $this->getJson('/api/v1/admin/coupons?q=A-2')->assertJsonPath('data.0.id', $coupon->id);

        $sold = CouponCode::where('code', 'OLD-1')->sole();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/{$sold->id}")->assertJsonValidationErrors('code');
        $free = CouponCode::where('code', 'A-1')->sole();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/{$free->id}")->assertOk()->assertJsonPath('stock', 1);

        $other = Coupon::factory()->uniqueCodes(['ELSEWHERE'])->create();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/".$other->codes()->sole()->id)->assertNotFound();
    }

    public function test_codes_held_by_an_open_checkout_cannot_be_removed(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['HELD'])->create();
        $this->buy(User::factory()->create(), $coupon);
        $this->actingAsAdmin();

        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/".CouponCode::sole()->id)->assertJsonValidationErrors('code');
        $this->assertSame(1, CouponCode::count());
    }

    public function test_switching_to_unique_codes(): void
    {
        $this->actingAsAdmin();
        $shared = Coupon::factory()->paid(stock: 50)->create();

        // A paid coupon in pool mode needs no shared code; its stock is the pool, whatever is typed.
        $id = $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $shared->store_id, 'title' => 'Pool', 'type' => 'Coupon Code',
            'price_cents' => 299, 'unique_codes' => true, 'stock' => 99,
        ])->assertCreated()->assertJsonPath('data.stock', 0)->json('data.id');
        $this->postJson("/api/v1/admin/coupons/{$id}/codes", ['codes' => ['P-1']])->assertCreated();
        $this->patchJson("/api/v1/admin/coupons/{$id}", ['stock' => 99])->assertOk()->assertJsonPath('data.stock', 1);

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $shared->store_id, 'title' => 'Free', 'type' => 'Deal', 'price_cents' => 0, 'unique_codes' => true,
        ])->assertJsonValidationErrors('unique_codes');
        $this->postJson("/api/v1/admin/coupons/{$shared->id}/codes", ['codes' => ['X']])->assertJsonValidationErrors('codes');

        $shared->codes()->create(['code' => 'LEFT-FROM-BEFORE']);
        $this->patchJson("/api/v1/admin/coupons/{$shared->id}", ['unique_codes' => true, 'code' => null])
            ->assertOk()->assertJsonPath('data.stock', 1);

        $this->postJson("/api/v1/admin/coupons/{$id}/duplicate")->assertCreated()->assertJsonPath('data.stock', 0);
    }

    public function test_mode_cannot_change_while_a_shopper_is_paying(): void
    {
        $coupon = Coupon::factory()->uniqueCodes(['A'])->create();
        $this->buy(User::factory()->create(), $coupon);
        $this->actingAsAdmin();

        $this->patchJson("/api/v1/admin/coupons/{$coupon->id}", ['unique_codes' => false, 'code' => 'SHARED'])
            ->assertJsonValidationErrors('unique_codes');
        $this->assertTrue($coupon->fresh()->unique_codes);
    }
}
