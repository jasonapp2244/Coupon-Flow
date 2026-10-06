<?php

namespace Tests\Feature;

use App\Enums\RedemptionStatus;
use App\Models\Blog;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Endpoints added for the redesigned public site. */
class PublicSiteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_settings_expose_identity_and_seo_but_no_secrets(): void
    {
        Setting::create(['key' => 'general', 'value' => ['site_name' => 'Deal Desk', 'support_email' => 'help@dealdesk.test']]);
        Setting::create(['key' => 'seo', 'value' => ['meta_title' => 'Deal Desk codes']]);
        Setting::create(['key' => 'vendor', 'value' => ['api_key' => encrypt('sk_vendor_secret')]]);

        $response = $this->getJson('/api/v1/public/settings')->assertOk()
            ->assertJsonPath('data.site_name', 'Deal Desk')
            ->assertJsonPath('data.support_email', 'help@dealdesk.test')
            ->assertJsonPath('data.meta_title', 'Deal Desk codes')
            ->assertJsonPath('data.currency', 'usd');

        $this->assertStringNotContainsString('api_key', $response->getContent());
    }

    public function test_click_records_a_redemption_and_returns_the_store_link(): void
    {
        $coupon = Coupon::factory()->create(['code' => 'SAVE10', 'tracking_url' => 'https://shop.test/go']);
        Sanctum::actingAs(User::factory()->create(['name' => 'Tauseef']));

        $this->postJson("/api/v1/public/coupons/{$coupon->id}/click")->assertOk()
            ->assertExactJson(['url' => 'https://shop.test/go', 'code' => 'SAVE10']);

        $click = Redemption::sole();
        $this->assertSame(RedemptionStatus::Clicked, $click->status);
        $this->assertSame([$coupon->id, $coupon->store_id, 'SAVE10', 'Tauseef'], [$click->coupon_id, $click->store_id, $click->coupon_code, $click->user_name]);
    }

    public function test_click_never_reveals_a_paid_code(): void
    {
        $this->enableShop();
        $coupon = Coupon::factory()->paid()->create(['code' => 'SECRET']);

        $this->postJson("/api/v1/public/coupons/{$coupon->id}/click")->assertOk()->assertJsonPath('code', null);
        $this->assertSame('(exclusive)', Redemption::sole()->coupon_code);
        $this->assertSame('Guest', Redemption::sole()->user_name);
    }

    public function test_search_suggests_matching_stores_and_coupons(): void
    {
        $nike = Store::factory()->create(['name' => 'Nike']);
        Store::factory()->create(['name' => 'Adidas']);
        Coupon::factory()->for($nike)->create(['title' => '15% off running shoes']);

        $this->getJson('/api/v1/public/search?q=nik')->assertOk()
            ->assertJsonCount(1, 'stores')->assertJsonPath('stores.0.name', 'Nike')
            ->assertJsonCount(1, 'coupons')->assertJsonPath('coupons.0.title', '15% off running shoes');

        $this->getJson('/api/v1/public/search?q=')->assertOk()->assertExactJson(['stores' => [], 'coupons' => []]);
    }

    public function test_search_treats_wildcards_literally(): void
    {
        Store::factory()->create(['name' => 'Nike']);

        $this->getJson('/api/v1/public/search?q=%25')->assertOk()->assertJsonCount(0, 'stores');
        $this->getJson('/api/v1/public/stores?q=_')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_category_page_lists_its_stores_and_coupons(): void
    {
        $fashion = Category::factory()->create(['name' => 'Fashion', 'slug' => 'fashion']);
        $zara = Store::factory()->create(['name' => 'Zara', 'category_id' => $fashion->id]);
        Store::factory()->create(['name' => 'Other']);
        Coupon::factory()->for($zara)->create(['title' => 'Zara 20%']);

        $this->getJson('/api/v1/public/categories/fashion')->assertOk()
            ->assertJsonPath('data.name', 'Fashion')
            ->assertJsonCount(1, 'stores')->assertJsonPath('stores.0.category_slug', 'fashion')
            ->assertJsonCount(1, 'coupons')->assertJsonPath('coupons.0.title', 'Zara 20%');

        $this->getJson('/api/v1/public/categories/missing')->assertNotFound();
    }

    public function test_store_page_includes_related_stores_from_the_same_category(): void
    {
        $tech = Category::factory()->create();
        Store::factory()->create(['category_id' => $tech->id, 'slug' => 'best-buy']);
        Store::factory()->create(['category_id' => $tech->id, 'name' => 'Newegg']);
        Store::factory()->create(['name' => 'Unrelated']);

        $this->getJson('/api/v1/public/stores/best-buy')->assertOk()
            ->assertJsonCount(1, 'related')->assertJsonPath('related.0.name', 'Newegg');
    }

    public function test_stores_filter_by_first_letter(): void
    {
        Store::factory()->create(['name' => 'Amazon']);
        Store::factory()->create(['name' => 'Best Buy']);
        Store::factory()->create(['name' => '7-Eleven']);

        $this->getJson('/api/v1/public/stores?letter=a')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Amazon');
        $this->getJson('/api/v1/public/stores?letter=%23')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', '7-Eleven');
    }

    public function test_coupons_can_be_ordered_by_ending_soon_and_filtered_to_verified(): void
    {
        Coupon::factory()->create(['title' => 'Later', 'expires_at' => now()->addMonths(2)->toDateString()]);
        Coupon::factory()->create(['title' => 'Open ended', 'expires_at' => null]);
        Coupon::factory()->create(['title' => 'Soon', 'expires_at' => now()->addDay()->toDateString(), 'is_verified' => true]);

        $this->getJson('/api/v1/public/coupons?order=ending_soon')
            ->assertJsonPath('data.0.title', 'Soon')->assertJsonPath('data.1.title', 'Later')->assertJsonPath('data.2.title', 'Open ended');

        $this->getJson('/api/v1/public/coupons?verified=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Soon');
    }

    public function test_blog_list_omits_the_body_and_a_post_includes_related_posts(): void
    {
        $posts = Blog::factory()->count(2)->create(['body' => 'Full article text']);

        $this->getJson('/api/v1/public/blogs')->assertOk()->assertJsonMissingPath('data.0.body');

        $this->getJson("/api/v1/public/blogs/{$posts[0]->slug}")->assertOk()
            ->assertJsonPath('data.body', 'Full article text')
            ->assertJsonCount(1, 'related')->assertJsonMissingPath('related.0.body');
    }

    public function test_related_posts_fall_back_to_other_topics(): void
    {
        $post = Blog::factory()->create(['category_id' => Category::factory()->blog()->create()->id]);
        Blog::factory()->create(['title' => 'Other topic', 'category_id' => Category::factory()->blog()->create()->id]);

        $this->getJson("/api/v1/public/blogs/{$post->slug}")->assertJsonPath('related.0.title', 'Other topic');
    }

    public function test_sitemap_lists_only_public_slugs(): void
    {
        Store::factory()->create(['slug' => 'nike']);
        Store::factory()->inactive()->create(['slug' => 'hidden']);
        Category::factory()->create(['slug' => 'sports']);
        Blog::factory()->create(['slug' => 'spring-sales']);
        Blog::factory()->draft()->create(['slug' => 'draft-post']);

        $this->getJson('/api/v1/public/sitemap')->assertOk()
            ->assertJsonPath('stores.0.slug', 'nike')->assertJsonCount(1, 'stores')
            ->assertJsonPath('categories.0.slug', 'sports')
            ->assertJsonPath('blogs.0.slug', 'spring-sales')->assertJsonCount(1, 'blogs');
    }

    public function test_coupon_expiry_follows_the_store_timezone(): void
    {
        // 03:00 UTC on the 2nd is still the 1st in New York: a coupon ending on the 1st is live there.
        $this->travelTo(now()->setTimezone('UTC')->setDate(2026, 10, 2)->setTime(3, 0));
        Setting::create(['key' => 'general', 'value' => ['timezone' => 'America/New_York']]);
        Coupon::factory()->create(['expires_at' => '2026-10-01']);

        $this->getJson('/api/v1/public/coupons')->assertJsonCount(1, 'data');
    }
}
