<?php

namespace Tests\Feature;

use App\Enums\RedemptionStatus;
use App\Models\ActivityLog;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\User;
use App\Notifications\AdminActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Code lists (next code per click, several per visitor up to a daily limit) and commission profit. */
class CodeListAndProfitTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

    private const TOKEN_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

    private const TOKEN_C = 'cccccccc-3333-4333-8333-cccccccccccc';

    private function codeList(array $codes, int $perVisitor = 5): Coupon
    {
        $this->actingAsAdmin();
        $store = Store::factory()->create(['commission_percent' => 8]);
        $id = $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Nike 20% Off', 'type' => 'Coupon Code',
            'unique_codes' => true, 'max_codes_per_visitor' => $perVisitor, 'status' => 'Active',
        ])->assertCreated()->assertJsonPath('data.code', null)->json('data.id');

        $this->postJson("/api/v1/admin/coupons/{$id}/codes", ['codes' => implode("\n", $codes)])->assertCreated();
        $this->app['auth']->forgetGuards();

        return Coupon::findOrFail($id);
    }

    private function reveal(Coupon $coupon, ?string $token, string $ip = '10.0.0.1')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->getJson("/api/v1/public/coupons/{$coupon->id}/reveal".($token ? "?t={$token}" : ''));
    }

    public function test_each_click_gets_the_next_code_and_a_refresh_keeps_it(): void
    {
        $coupon = $this->codeList(['NIKE-0001', 'NIKE-0002', 'NIKE-0003']);

        $this->reveal($coupon, self::TOKEN_A)->assertOk()->assertJsonPath('data.code', 'NIKE-0001')->assertJsonPath('data.limit_reached', false);
        $this->reveal($coupon, self::TOKEN_A)->assertJsonPath('data.code', 'NIKE-0001'); // refresh: same code
        $this->get("/api/go/{$coupon->id}?t=".self::TOKEN_A)->assertRedirect(); // the redirect for the same click takes nothing new
        $this->reveal($coupon, self::TOKEN_B)->assertJsonPath('data.code', 'NIKE-0002'); // "Get another code"
        $this->reveal($coupon, self::TOKEN_C, '10.0.0.2')->assertJsonPath('data.code', 'NIKE-0003')
            ->assertJsonPath('data.uses_left', 0)->assertJsonPath('data.code_list', true);

        $this->assertSame(3, Redemption::count());
        $this->assertSame(['NIKE-0001', 'NIKE-0002', 'NIKE-0003'], Redemption::orderBy('id')->pluck('coupon_code')->all());
        $this->assertSame(3, $coupon->refresh()->uses_count);
    }

    public function test_listings_never_carry_list_codes_and_no_token_means_no_code(): void
    {
        $coupon = $this->codeList(['SECRET-1', 'SECRET-2']);

        $list = $this->getJson('/api/v1/public/coupons')->assertOk()
            ->assertJsonPath('data.0.code_list', true)->assertJsonPath('data.0.has_code', true)->assertJsonPath('data.0.uses_left', 2);
        $this->assertStringNotContainsString('SECRET', $list->getContent());

        $this->reveal($coupon, null)->assertOk()->assertJsonPath('data.code', null);
        $this->reveal($coupon, 'bad token!')->assertOk()->assertJsonPath('data.code', null);
        $this->assertSame(0, Redemption::count());
    }

    public function test_a_visitor_may_take_several_codes_up_to_the_daily_limit(): void
    {
        $coupon = $this->codeList(['C1', 'C2', 'C3', 'C4'], perVisitor: 2);

        $this->reveal($coupon, self::TOKEN_A)->assertJsonPath('data.code', 'C1');
        $this->reveal($coupon, self::TOKEN_B)->assertJsonPath('data.code', 'C2');
        $this->reveal($coupon, self::TOKEN_C)->assertOk()
            ->assertJsonPath('data.limit_reached', true)->assertJsonPath('data.code', 'C2');
        $this->reveal($coupon, self::TOKEN_A)->assertJsonPath('data.code', 'C1')->assertJsonPath('data.limit_reached', false);

        // The redirect refuses a new code too, and sends the visitor back to the store page.
        $this->get("/api/go/{$coupon->id}?t=dddddddd-4444-4444-8444-dddddddddddd")
            ->assertRedirect(config('services.frontend.public_url').'/stores/'.$coupon->store->slug);

        // Another visitor is not affected; tomorrow the limit starts again.
        $this->reveal($coupon, 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee', '10.0.0.9')->assertJsonPath('data.code', 'C3');
        $this->travel(25)->hours();
        $this->reveal($coupon, 'ffffffff-6666-4666-8666-ffffffffffff')->assertJsonPath('data.code', 'C4');
    }

    public function test_zero_means_no_daily_limit(): void
    {
        $coupon = $this->codeList(['A', 'B', 'C'], perVisitor: 0);

        foreach ([self::TOKEN_A, self::TOKEN_B, self::TOKEN_C] as $token) {
            $this->reveal($coupon, $token)->assertJsonPath('data.limit_reached', false);
        }
        $this->assertSame(3, Redemption::count());
    }

    public function test_an_empty_list_hides_the_coupon_and_alerts_staff_once(): void
    {
        Notification::fake();
        $coupon = $this->codeList(['ONLY-1', 'ONLY-2', 'ONLY-3', 'ONLY-4', 'ONLY-5'], perVisitor: 0);
        $staff = User::factory()->admin()->create();

        foreach (['11', '22', '33', '44', '55'] as $n) {
            $this->reveal($coupon, "{$n}{$n}{$n}{$n}{$n}{$n}{$n}{$n}-0000-4000-8000-000000000000");
        }

        $this->getJson('/api/v1/public/coupons')->assertJsonCount(0, 'data');
        $this->get("/api/go/{$coupon->id}?t=".self::TOKEN_C)->assertRedirect(config('services.frontend.public_url').'/stores/'.$coupon->store->slug);
        // "running out" at 4 of 5 handed out, then "no codes left".
        Notification::assertSentToTimes($staff, AdminActivity::class, 2);

        // Topping the list up brings it back.
        $this->actingAsAdmin();
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => 'ONLY-6'])->assertCreated()->assertJson(['added' => 1, 'total' => 6, 'left' => 1]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/public/coupons')->assertJsonCount(1, 'data');
    }

    public function test_admin_manages_the_code_list(): void
    {
        $coupon = $this->codeList(['X-1', 'X-2']);
        $this->actingAsAdmin();

        $file = UploadedFile::fake()->createWithContent('codes.csv', "X-2\nX-3\n\"X-4\",note\n");
        $this->post("/api/v1/admin/coupons/{$coupon->id}/codes", ['file' => $file], ['Accept' => 'application/json'])
            ->assertCreated()->assertJson(['added' => 2, 'skipped' => 1, 'total' => 4, 'left' => 4]);
        // A spreadsheet export: byte-order mark and a "Coupon code" header row, which is not a code.
        $export = UploadedFile::fake()->createWithContent('export.csv', "\xEF\xBB\xBFCoupon code,Note\nX-5,first\n");
        $this->post("/api/v1/admin/coupons/{$coupon->id}/codes", ['file' => $export], ['Accept' => 'application/json'])
            ->assertCreated()->assertJson(['added' => 1, 'total' => 5]);
        $this->assertFalse($coupon->codes()->where('code', 'like', '%code%')->exists());
        $coupon->codes()->where('code', 'X-5')->delete();
        $coupon->syncCodeCounts();
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => " \n , "])->assertJsonValidationErrors('codes');

        $this->app['auth']->forgetGuards();
        $this->reveal($coupon, self::TOKEN_A);
        $this->actingAsAdmin();

        $used = $coupon->codes()->whereNotNull('redemption_id')->sole();
        $free = $coupon->codes()->whereNull('redemption_id')->first();
        $this->getJson("/api/v1/admin/coupons/{$coupon->id}/codes?state=used")->assertOk()
            ->assertJsonPath('data.0.code', 'X-1')->assertJsonPath('data.0.used', true)
            ->assertJsonPath('data.0.redemption_reference', Redemption::sole()->reference)
            ->assertJsonPath('counts', ['total' => 4, 'left' => 3]);
        $this->getJson("/api/v1/admin/coupons/{$coupon->id}")->assertJsonPath('data.codes_total', 4)->assertJsonPath('data.codes_left', 3);
        $this->getJson('/api/v1/admin/coupons?q=X-3')->assertJsonPath('data.0.id', $coupon->id);

        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/{$used->id}")->assertUnprocessable();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}/codes/{$free->id}")->assertNoContent();
        $this->assertSame(3, $coupon->refresh()->usage_limit);
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/reset-uses")->assertUnprocessable();
        $this->assertTrue(ActivityLog::where('action', 'codes_added')->exists());

        Sanctum::actingAs(User::factory()->viewer()->create());
        $this->getJson("/api/v1/admin/coupons/{$coupon->id}/codes")->assertOk();
        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/codes", ['codes' => 'Y'])->assertForbidden();
    }

    public function test_confirming_a_sale_adds_profit_at_the_commission_rate(): void
    {
        $coupon = $this->codeList(['P-1', 'P-2']);
        $this->reveal($coupon, self::TOKEN_A);
        $this->reveal($coupon, self::TOKEN_B);
        [$first, $second] = Redemption::orderBy('id')->get()->all();
        $this->actingAsAdmin();

        // Store rate 8%: $150 → $12.00.
        $this->patchJson("/api/v1/admin/redemptions/{$first->id}", ['status' => 'Used', 'order_value' => 150])->assertOk()
            ->assertJsonPath('data.status', 'Used')->assertJsonPath('data.order_value_cents', 15000)
            ->assertJsonPath('data.commission_cents', 1200)->assertJsonPath('data.commission_percent', 8);

        // The coupon's own rate wins, and a later store change doesn't rewrite the confirmed sale.
        $coupon->update(['commission_percent' => 10]);
        $coupon->store->update(['commission_percent' => 3]);
        $this->patchJson("/api/v1/admin/redemptions/{$second->id}", ['status' => 'Used', 'order_value' => 99.99])
            ->assertJsonPath('data.commission_cents', 1000)->assertJsonPath('data.commission_percent', 10);
        $this->assertSame(1200, $first->refresh()->commission_cents);

        $this->getJson('/api/v1/admin/redemptions/summary')->assertJsonPath('commission_cents', 2200)->assertJsonPath('conversion_rate', 100);
        $this->getJson('/api/v1/admin/dashboard')->assertJsonPath('kpis.profit_30d_cents', 2200)->assertJsonPath('kpis.sales_30d', 2);
        $this->getJson('/api/v1/admin/analytics?days=7')->assertJsonPath('profit_by_store.0.profit_cents', 2200)->assertJsonPath('profit_by_store.0.sales', 2);

        // A failed sale clears the money; Used needs an amount.
        $this->patchJson("/api/v1/admin/redemptions/{$second->id}", ['status' => 'Failed'])->assertOk()->assertJsonPath('data.commission_cents', 0);
        $this->patchJson("/api/v1/admin/redemptions/{$second->id}", ['status' => 'Used'])->assertJsonValidationErrors('order_value');
        $this->patchJson("/api/v1/admin/redemptions/{$second->id}", ['status' => 'Used', 'order_value' => 0])->assertJsonValidationErrors('order_value');
        // Two confirmations and the change to Failed; the refused ones leave no entry.
        $this->assertSame(3, ActivityLog::where('action', 'sale_confirmed')->count());

        Sanctum::actingAs(User::factory()->viewer()->create());
        $this->patchJson("/api/v1/admin/redemptions/{$first->id}", ['status' => 'Failed'])->assertForbidden();
    }

    public function test_an_unconfirmed_click_shows_the_rate_its_sale_will_use(): void
    {
        $coupon = $this->codeList(['R-1', 'R-2']);
        $this->reveal($coupon, self::TOKEN_A);
        $this->actingAsAdmin();

        // Not confirmed yet: no rate stored on the click, but the store's 8% will apply.
        $this->getJson('/api/v1/admin/redemptions')->assertOk()
            ->assertJsonPath('data.0.commission_percent', null)
            ->assertJsonPath('data.0.commission_rate', 8);

        // The coupon's own rate wins over the store's.
        $coupon->update(['commission_percent' => 12.5]);
        $this->getJson('/api/v1/admin/redemptions')->assertJsonPath('data.0.commission_rate', 12.5);

        // Neither set: no rate, so the admin is told to set one.
        $coupon->update(['commission_percent' => null]);
        $coupon->store->update(['commission_percent' => null]);
        $this->getJson('/api/v1/admin/redemptions')->assertJsonPath('data.0.commission_rate', null);

        // Once confirmed, the rate stored on the sale is the one reported.
        $coupon->store->update(['commission_percent' => 5]);
        $id = Redemption::firstOrFail()->id;
        $this->patchJson("/api/v1/admin/redemptions/{$id}", ['status' => 'Used', 'order_value' => 100])
            ->assertJsonPath('data.commission_rate', 5)->assertJsonPath('data.commission_cents', 500);
        $coupon->store->update(['commission_percent' => 9]);
        $this->getJson('/api/v1/admin/redemptions')->assertJsonPath('data.0.commission_rate', 5);
    }

    public function test_a_shared_code_still_works_as_before_with_a_token(): void
    {
        $coupon = Coupon::factory()->create(['code' => 'SAVE20', 'usage_limit' => 5]);

        $this->get("/api/go/{$coupon->id}?t=".self::TOKEN_A)->assertRedirect();
        $this->get("/api/go/{$coupon->id}?t=".self::TOKEN_A)->assertRedirect(); // same click
        $this->get("/api/go/{$coupon->id}")->assertRedirect();
        $this->reveal($coupon, self::TOKEN_A)->assertJsonPath('data.code', 'SAVE20')->assertJsonPath('data.code_list', false);

        $this->assertSame(2, $coupon->refresh()->uses_count);
    }

    public function test_unconfirmed_clicks_expire_after_30_days(): void
    {
        $old = Redemption::create(['reference' => 'CLK-OLD', 'user_name' => 'Guest', 'coupon_code' => 'X', 'status' => RedemptionStatus::Clicked, 'clicked_at' => now()->subDays(31)]);
        $recent = Redemption::create(['reference' => 'CLK-NEW', 'user_name' => 'Guest', 'coupon_code' => 'X', 'status' => RedemptionStatus::Clicked, 'clicked_at' => now()->subDays(5)]);
        $sold = Redemption::create(['reference' => 'CLK-SOLD', 'user_name' => 'Guest', 'coupon_code' => 'X', 'status' => RedemptionStatus::Used, 'clicked_at' => now()->subDays(40)]);

        $this->artisan('redemptions:expire')->assertSuccessful();

        $this->assertSame(RedemptionStatus::Expired, $old->refresh()->status);
        $this->assertSame(RedemptionStatus::Clicked, $recent->refresh()->status);
        $this->assertSame(RedemptionStatus::Used, $sold->refresh()->status);
    }

    public function test_store_commission_is_saved_and_validated(): void
    {
        $this->actingAsAdmin();
        $store = Store::factory()->create();

        $this->putJson("/api/v1/admin/stores/{$store->id}", ['commission_percent' => 7.5])->assertOk()->assertJsonPath('data.commission_percent', 7.5);
        $this->putJson("/api/v1/admin/stores/{$store->id}", ['commission_percent' => 120])->assertJsonValidationErrors('commission_percent');
        $this->getJson("/api/v1/public/stores/{$store->slug}")->assertJsonMissingPath('data.commission_percent');
    }
}
