<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Setting;
use App\Models\Store;
use App\Services\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A coupon works only inside its exact deal window (date + time), never outside it. */
class DealWindowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.frontend.public_url' => 'https://site.test']);
        Setting::create(['key' => 'general', 'value' => ['timezone' => 'America/New_York']]);
        app(SiteSettings::class)->forget();
    }

    public function test_admin_times_are_read_in_the_store_timezone_and_stored_in_utc(): void
    {
        $this->actingAsAdmin();
        $store = Store::factory()->create();

        $id = $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Weekend sale', 'type' => 'Deal', 'status' => 'Active',
            'starts_at' => '2026-10-09T09:00', 'expires_at' => '2026-10-11T23:59',
        ])->assertCreated()
            ->assertJsonPath('data.starts_at', '2026-10-09T13:00:00+00:00')
            ->assertJsonPath('data.starts_at_local', '2026-10-09T09:00')
            ->assertJsonPath('data.expires_at_local', '2026-10-11T23:59')
            ->json('data.id');

        $this->assertSame('2026-10-12 03:59:00', Coupon::find($id)->getRawOriginal('expires_at'));

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Backwards', 'type' => 'Deal',
            'starts_at' => '2026-10-11T10:00', 'expires_at' => '2026-10-11T09:00',
        ])->assertUnprocessable()->assertJsonValidationErrors('expires_at');
    }

    public function test_a_bare_date_means_the_whole_day_in_the_store_timezone(): void
    {
        $coupon = Coupon::factory()->create(['starts_at' => '2026-10-09', 'expires_at' => '2026-10-11']);

        $this->assertSame('2026-10-09 04:00:00', $coupon->getRawOriginal('starts_at'));
        $this->assertSame('2026-10-12 03:59:59', $coupon->getRawOriginal('expires_at'));
    }

    public function test_the_coupon_is_hidden_and_its_link_blocked_outside_the_window(): void
    {
        $store = Store::factory()->create(['slug' => 'tea-shop']);
        $coupon = Coupon::factory()->for($store)->create(['starts_at' => '2026-10-09T09:00', 'expires_at' => '2026-10-09T17:00']);

        foreach (['2026-10-09 12:59:00' => false, '2026-10-09 13:00:00' => true, '2026-10-09 21:00:00' => true, '2026-10-09 21:00:01' => false] as $utc => $live) {
            $this->travelTo(CarbonImmutable::parse($utc, 'UTC'));
            $ids = collect($this->getJson('/api/v1/public/stores/tea-shop')->json('coupons'))->pluck('id');
            $this->assertSame($live, $ids->contains($coupon->id), "at {$utc} UTC");

            $go = $this->get("/api/go/{$coupon->id}");
            $live ? $go->assertRedirect($store->tracking_url ?: $store->direct_url) : $go->assertRedirect('https://site.test/stores/tea-shop');
            $this->getJson("/api/v1/public/coupons/{$coupon->id}/reveal")->assertStatus($live ? 200 : 404);
        }

        $this->assertSame(2, Redemption::count());
        $this->assertSame(2, $coupon->fresh()->uses_count);
    }

    public function test_admin_sees_each_coupons_state_and_can_filter_by_it(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-09 15:00:00', 'UTC'));
        $this->actingAsAdmin();
        $live = Coupon::factory()->create(['title' => 'Live']);
        Coupon::factory()->create(['title' => 'Soon', 'starts_at' => now()->addHour()]);
        Coupon::factory()->create(['title' => 'Over', 'expires_at' => now()->subMinute()]);
        Coupon::factory()->create(['title' => 'Gone', 'usage_limit' => 1])->forceFill(['uses_count' => 1])->save();
        Coupon::factory()->create(['title' => 'Hidden', 'status' => 'Draft']);

        $states = collect($this->getJson('/api/v1/admin/coupons?per_page=50')->json('data'))->pluck('state', 'title')->all();
        $this->assertEquals(['Live' => 'live', 'Soon' => 'scheduled', 'Over' => 'ended', 'Gone' => 'used_up', 'Hidden' => 'draft'], array_intersect_key($states, array_flip(['Live', 'Soon', 'Over', 'Gone', 'Hidden'])));

        foreach (['live' => 'Live', 'scheduled' => 'Soon', 'ended' => 'Over', 'used_up' => 'Gone', 'draft' => 'Hidden'] as $state => $title) {
            $this->getJson("/api/v1/admin/coupons?state={$state}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', $title);
        }
        $this->getJson('/api/v1/admin/coupons?expired=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Over');
        $this->assertSame('live', $live->fresh()->state());
    }
}
