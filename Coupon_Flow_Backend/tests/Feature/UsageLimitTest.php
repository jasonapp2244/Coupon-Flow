<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\User;
use App\Notifications\AdminActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Every coupon can have a usage limit: each click uses one ("500 → 499"), shown as % used. */
class UsageLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_each_click_takes_one_use_and_the_site_shows_what_is_left(): void
    {
        $store = Store::factory()->create(['slug' => 'tea-shop']);
        $coupon = Coupon::factory()->for($store)->create(['usage_limit' => 500]);

        $this->get("/api/go/{$coupon->id}");

        $this->getJson('/api/v1/public/stores/tea-shop')
            ->assertJsonPath('coupons.0.uses_count', 1)
            ->assertJsonPath('coupons.0.uses_left', 499)
            ->assertJsonPath('coupons.0.usage_limit', 500)
            ->assertJsonPath('coupons.0.used_percent', 0.2)
            ->assertJsonPath('coupons.0.used_count', 1);
    }

    public function test_the_last_use_hides_the_coupon_and_later_clicks_are_turned_away(): void
    {
        config(['services.frontend.public_url' => 'https://site.test']);
        $store = Store::factory()->create(['slug' => 'tea-shop', 'direct_url' => 'https://merchant.test', 'tracking_url' => null]);
        $coupon = Coupon::factory()->for($store)->create(['usage_limit' => 2, 'tracking_url' => null]);

        $this->get("/api/go/{$coupon->id}")->assertRedirect('https://merchant.test');
        $this->get("/api/go/{$coupon->id}")->assertRedirect('https://merchant.test');
        $this->get("/api/go/{$coupon->id}")->assertRedirect('https://site.test/stores/tea-shop');

        $this->assertSame(2, $coupon->fresh()->uses_count);
        $this->assertSame(2, Redemption::count());
        $this->assertTrue($coupon->fresh()->isUsedUp());
        $this->getJson('/api/v1/public/stores/tea-shop')->assertJsonCount(0, 'coupons');
        // The shopper whose click took the last use still sees the code in the pop-up.
        $this->getJson("/api/v1/public/coupons/{$coupon->id}/reveal")->assertOk()->assertJsonPath('data.code', $coupon->code);
        // Outside its window it is gone for good.
        $coupon->update(['expires_at' => now()->subMinute()]);
        $this->getJson("/api/v1/public/coupons/{$coupon->id}/reveal")->assertNotFound();
    }

    public function test_a_coupon_without_a_limit_never_runs_out(): void
    {
        $coupon = Coupon::factory()->create(['usage_limit' => null]);
        foreach (range(1, 5) as $_) {
            $this->get("/api/go/{$coupon->id}");
        }

        $this->assertSame(5, $coupon->fresh()->uses_count);
        $this->assertNull($coupon->fresh()->usesLeft());
        $this->assertNull($coupon->fresh()->usedPercent());
    }

    public function test_staff_are_alerted_once_at_80_percent_and_once_when_used_up(): void
    {
        Notification::fake();
        $editor = User::factory()->editor()->create();
        $coupon = Coupon::factory()->create(['usage_limit' => 5, 'title' => 'Save 10%']);

        foreach (range(1, 7) as $_) {
            $this->get("/api/go/{$coupon->id}");
        }

        $texts = Notification::sent($editor, AdminActivity::class)->map(fn (AdminActivity $n) => $n->text)->all();
        $this->assertCount(2, $texts);
        $this->assertStringContainsString('nearly used up: 4 of 5', $texts[0]);
        $this->assertStringContainsString('is used up: all 5 uses taken', $texts[1]);
    }

    public function test_admin_sets_a_limit_sees_the_percentage_and_can_reset_uses(): void
    {
        $this->actingAsAdmin();
        $coupon = Coupon::factory()->create();
        $coupon->forceFill(['uses_count' => 90])->save();

        $this->patchJson("/api/v1/admin/coupons/{$coupon->id}", ['usage_limit' => 100])->assertOk()
            ->assertJsonPath('data.usage_limit', 100)
            ->assertJsonPath('data.uses_left', 10)
            ->assertJsonPath('data.used_percent', 90);

        $this->getJson('/api/v1/admin/coupons?near_limit=1')->assertJsonCount(1, 'data');
        $this->patchJson("/api/v1/admin/coupons/{$coupon->id}", ['usage_limit' => 0])->assertUnprocessable();

        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/reset-uses")->assertOk()->assertJsonPath('data.uses_count', 0);
        $this->assertSame(['uses_count' => [90, 0]], ActivityLog::where('action', 'uses_reset')->sole()->changes);
        // The uses count itself never floods the log.
        $this->assertFalse(ActivityLog::where('action', 'updated')->whereJsonContainsKey('changes->uses_count')->exists());
    }

    public function test_admin_sorts_by_percent_used_with_unlimited_coupons_last(): void
    {
        $this->actingAsAdmin();
        Coupon::factory()->create(['title' => 'Unlimited']);
        Coupon::factory()->create(['title' => 'Half', 'usage_limit' => 10])->forceFill(['uses_count' => 5])->save();
        Coupon::factory()->create(['title' => 'Most', 'usage_limit' => 4])->forceFill(['uses_count' => 3])->save();

        $titles = collect($this->getJson('/api/v1/admin/coupons?sort=used_percent&dir=desc')->json('data'))->pluck('title')->all();
        $this->assertSame(['Most', 'Half', 'Unlimited'], $titles);
    }

    public function test_viewers_cannot_reset_uses(): void
    {
        $coupon = Coupon::factory()->create();
        Sanctum::actingAs(User::factory()->viewer()->create());

        $this->postJson("/api/v1/admin/coupons/{$coupon->id}/reset-uses")->assertForbidden();
    }
}
