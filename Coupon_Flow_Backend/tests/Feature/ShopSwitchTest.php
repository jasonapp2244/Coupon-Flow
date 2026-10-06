<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Store;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Settings → General → "Sell exclusive codes": off by default, the site is a plain free-coupon site. */
class ShopSwitchTest extends TestCase
{
    use RefreshDatabase;

    public function test_shop_is_off_by_default_and_paid_coupons_are_hidden_everywhere(): void
    {
        config(['services.frontend.public_url' => 'https://site.test']);
        $category = Category::factory()->create(['slug' => 'tea']);
        $store = Store::factory()->create(['slug' => 'tea-shop', 'category_id' => $category->id]);
        $free = Coupon::factory()->for($store)->create(['title' => 'Free one']);
        $paid = Coupon::factory()->for($store)->paid()->create(['title' => 'Paid one', 'code' => 'SECRET']);

        $this->getJson('/api/v1/public/settings')->assertJsonPath('data.shop_enabled', false);

        $this->getJson('/api/v1/public/coupons')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $free->id);
        $this->getJson('/api/v1/public/stores/tea-shop')->assertJsonCount(1, 'coupons');
        $this->getJson('/api/v1/public/categories/tea')->assertJsonCount(1, 'coupons');
        $this->getJson('/api/v1/public/stores')->assertJsonPath('data.0.coupons_count', 1);
        $this->getJson('/api/v1/public/search?q=one')->assertJsonCount(1, 'coupons');
        $this->getJson("/api/v1/public/coupons/{$paid->id}")->assertNotFound();
        $this->getJson("/api/v1/public/coupons/{$paid->id}/reveal")->assertNotFound();

        $this->get("/api/go/{$paid->id}")->assertRedirect('https://site.test/stores/tea-shop');
        $this->assertSame(0, Redemption::count());
    }

    public function test_checkout_is_closed_while_the_shop_is_off(): void
    {
        $paid = Coupon::factory()->paid()->create();
        $this->actingAsCustomer();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [$paid->id]])
            ->assertForbidden()->assertJsonPath('message', 'Exclusive codes are not on sale right now.');
    }

    public function test_admin_switches_the_shop_on(): void
    {
        $paid = Coupon::factory()->paid()->create();
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/settings')->assertOk()->assertJsonPath('data.general.shop_enabled', false);
        $this->putJson('/api/v1/admin/settings/general', ['shop_enabled' => true])->assertOk();

        $this->getJson('/api/v1/public/settings')->assertJsonPath('data.shop_enabled', true);
        $this->getJson('/api/v1/public/coupons')->assertJsonPath('data.0.id', $paid->id);

        $this->putJson('/api/v1/admin/settings/general', ['shop_enabled' => 'maybe'])->assertUnprocessable();
    }

    public function test_admin_still_sees_paid_coupons_while_the_shop_is_off(): void
    {
        Coupon::factory()->paid()->create(['title' => 'Paid one']);
        $this->actingAsAdmin();

        $this->getJson('/api/v1/admin/coupons')->assertOk()->assertJsonPath('data.0.title', 'Paid one');
    }
}
