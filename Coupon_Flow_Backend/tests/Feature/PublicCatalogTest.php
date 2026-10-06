<?php

namespace Tests\Feature;

use App\Enums\CouponStatus;
use App\Models\Blog;
use App\Models\Coupon;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_coupon_listings_carry_no_codes_and_no_merchant_links(): void
    {
        $this->enableShop();
        $store = Store::factory()->create(['direct_url' => 'https://merchant.test', 'tracking_url' => 'https://aff.test/store']);
        Coupon::factory()->for($store)->create(['code' => 'FREE10', 'title' => 'Free one', 'tracking_url' => 'https://aff.test/coupon']);
        Coupon::factory()->for($store)->paid(299)->create(['code' => 'SECRET50', 'title' => 'Paid one']);
        Coupon::factory()->for($store)->create(['type' => 'Deal', 'code' => null, 'title' => 'Zero deal']);

        $response = $this->getJson('/api/v1/public/coupons?sort=title&dir=asc')->assertOk();

        $response->assertJsonPath('data.0.title', 'Free one')->assertJsonPath('data.0.has_code', true)
            ->assertJsonPath('data.1.title', 'Paid one')->assertJsonPath('data.1.has_code', true)
            ->assertJsonPath('data.1.is_paid', true)->assertJsonPath('data.1.price_cents', 299)
            ->assertJsonPath('data.2.has_code', false)
            ->assertJsonMissingPath('data.0.code')->assertJsonMissingPath('data.0.tracking_url');

        foreach (['FREE10', 'SECRET50', 'merchant.test', 'aff.test'] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }

        $page = $this->getJson("/api/v1/public/stores/{$store->slug}")->assertOk()
            ->assertJsonMissingPath('data.direct_url')->assertJsonMissingPath('data.tracking_url');
        $this->assertStringNotContainsString('aff.test', $page->getContent());
        $this->assertStringNotContainsString('merchant.test', $page->getContent());
    }

    public function test_only_live_coupons_of_active_stores_are_listed(): void
    {
        $visible = Coupon::factory()->create();
        Coupon::factory()->expired()->create();
        Coupon::factory()->create(['status' => CouponStatus::Draft]);
        Coupon::factory()->create(['starts_at' => now()->addWeek()->toDateString()]);
        Coupon::factory()->for(Store::factory()->inactive())->create();
        $trashedStoreCoupon = Coupon::factory()->create();
        $trashedStoreCoupon->store->delete();

        $this->getJson('/api/v1/public/coupons')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $visible->id);

        $this->getJson("/api/v1/public/coupons/{$trashedStoreCoupon->id}")->assertNotFound();
    }

    public function test_store_page_by_slug_lists_its_live_coupons(): void
    {
        $store = Store::factory()->create(['slug' => 'nike']);
        Coupon::factory()->count(2)->for($store)->create();
        Coupon::factory()->expired()->for($store)->create();

        $this->getJson('/api/v1/public/stores/nike')
            ->assertOk()
            ->assertJsonPath('data.slug', 'nike')
            ->assertJsonCount(2, 'coupons');

        Store::factory()->inactive()->create(['slug' => 'hidden']);
        $this->getJson('/api/v1/public/stores/hidden')->assertNotFound();
    }

    public function test_only_published_blogs_are_public(): void
    {
        Blog::factory()->create(['slug' => 'live-post']);
        Blog::factory()->draft()->create(['slug' => 'draft-post']);
        Blog::factory()->create(['slug' => 'future-post', 'published_at' => now()->addDay()]);

        $this->getJson('/api/v1/public/blogs')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/public/blogs/live-post')->assertOk();
        $this->getJson('/api/v1/public/blogs/draft-post')->assertNotFound();
    }
}
