<?php

namespace Tests\Feature;

use App\Enums\CouponStatus;
use App\Enums\RedemptionStatus;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** /api/go redirects, the code pop-up, and merchant links staying admin-only. */
class ClickOutTest extends TestCase
{
    use RefreshDatabase;

    public function test_go_records_the_click_and_redirects_to_the_most_specific_link(): void
    {
        $store = Store::factory()->create(['direct_url' => 'https://merchant.test', 'tracking_url' => 'https://aff.test/store']);
        $own = Coupon::factory()->for($store)->create(['code' => 'SAVE10', 'tracking_url' => 'https://aff.test/coupon']);
        $inherits = Coupon::factory()->for($store)->create(['type' => 'Deal', 'code' => null, 'tracking_url' => null]);

        $this->get("/api/go/{$own->id}")->assertRedirect('https://aff.test/coupon')
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->get("/api/go/{$inherits->id}")->assertRedirect('https://aff.test/store');

        $clicks = Redemption::orderBy('id')->get();
        $this->assertCount(2, $clicks);
        $this->assertSame(RedemptionStatus::Clicked, $clicks[0]->status);
        $this->assertSame(['SAVE10', '(deal)'], $clicks->pluck('coupon_code')->all());
        $this->assertSame('Guest', $clicks[0]->user_name);
    }

    public function test_store_page_shows_how_many_times_each_coupon_was_used(): void
    {
        $store = Store::factory()->create(['slug' => 'tea-shop']);
        $clicked = Coupon::factory()->for($store)->create();
        $untouched = Coupon::factory()->for($store)->create();

        $this->get("/api/go/{$clicked->id}");
        $this->get("/api/go/{$clicked->id}");

        $used = collect($this->getJson('/api/v1/public/stores/tea-shop')->assertOk()->json('coupons'))->pluck('used_count', 'id');
        $this->assertSame(2, $used[$clicked->id]);
        $this->assertSame(0, $used[$untouched->id]);

        // Coupon lists show it too; the search drop-down leaves it out rather than showing 0.
        $this->getJson('/api/v1/public/coupons?sort=title')->assertOk()->assertJsonPath('data.0.used_count', fn ($n) => is_int($n));
        $this->getJson('/api/v1/public/search?q='.urlencode($clicked->title))->assertOk()->assertJsonMissingPath('coupons.0.used_count');
    }

    public function test_go_falls_back_to_the_direct_url(): void
    {
        $store = Store::factory()->create(['direct_url' => 'https://merchant.test', 'tracking_url' => null]);
        $coupon = Coupon::factory()->for($store)->create(['tracking_url' => null]);

        $this->get("/api/go/{$coupon->id}")->assertRedirect('https://merchant.test');
        $this->get("/api/go/store/{$store->slug}")->assertRedirect('https://merchant.test');
    }

    public function test_dead_links_land_back_on_the_site_without_recording_a_click(): void
    {
        config(['services.frontend.public_url' => 'https://site.test']);
        $store = Store::factory()->create(['slug' => 'nike']);
        $expired = Coupon::factory()->for($store)->expired()->create();
        $draft = Coupon::factory()->for($store)->create(['status' => CouponStatus::Draft]);
        Store::factory()->inactive()->create(['slug' => 'hidden']);

        $this->get("/api/go/{$expired->id}")->assertRedirect('https://site.test/stores/nike');
        $this->get("/api/go/{$draft->id}")->assertRedirect('https://site.test/stores/nike');
        $this->get('/api/go/999999')->assertRedirect('https://site.test/');
        $this->get('/api/go/store/hidden')->assertRedirect('https://site.test/stores');
        $this->get('/api/go/store/missing')->assertRedirect('https://site.test/stores');

        $this->assertSame(0, Redemption::count());
    }

    public function test_reveal_shows_the_code_but_no_merchant_link(): void
    {
        $free = Coupon::factory()->create(['code' => 'FREE10']);

        $this->getJson("/api/v1/public/coupons/{$free->id}/reveal")->assertOk()
            ->assertJsonPath('data.code', 'FREE10')
            ->assertJsonPath('data.store.slug', $free->store->slug)
            ->assertJsonMissingPath('data.tracking_url');

        $this->getJson('/api/v1/public/coupons/'.Coupon::factory()->expired()->create()->id.'/reveal')->assertNotFound();
        $this->assertSame(0, Redemption::count());
    }

    public function test_admins_still_see_merchant_links(): void
    {
        $this->actingAsAdmin();
        $store = Store::factory()->create(['direct_url' => 'https://merchant.test', 'tracking_url' => 'https://aff.test/store']);

        $this->getJson("/api/v1/admin/stores/{$store->id}")->assertOk()
            ->assertJsonPath('data.direct_url', 'https://merchant.test')
            ->assertJsonPath('data.tracking_url', 'https://aff.test/store');
    }
}
