<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\ActivityLog;
use App\Models\Blog;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\SyncRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsAdmin();
    }

    public function test_store_create_generates_a_unique_slug_and_stores_the_logo(): void
    {
        Storage::fake('public');
        Store::factory()->create(['slug' => 'amazon']);
        $category = Category::factory()->create();

        $response = $this->post('/api/v1/admin/stores', [
            'name' => 'Amazon',
            'direct_url' => 'https://amazon.com',
            'category_id' => $category->id,
            'status' => 'Active',
            'logo' => UploadedFile::fake()->image('logo.png'),
        ], ['Accept' => 'application/json']);

        $response->assertCreated()
            ->assertJsonPath('data.slug', 'amazon-2')
            ->assertJsonPath('data.category', $category->name);

        Storage::disk('public')->assertExists(Store::where('slug', 'amazon-2')->value('logo_path'));
    }

    public function test_store_validation_errors(): void
    {
        $this->postJson('/api/v1/admin/stores', ['name' => '', 'direct_url' => 'not-a-url'])
            ->assertJsonValidationErrors(['name', 'direct_url']);
    }

    public function test_store_list_filters_and_counts_coupons(): void
    {
        $nike = Store::factory()->create(['name' => 'Nike']);
        Store::factory()->inactive()->create(['name' => 'Adidas']);
        Coupon::factory()->count(2)->for($nike)->create();

        $this->getJson('/api/v1/admin/stores?q=nik')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.coupons_count', 2);

        $this->getJson('/api/v1/admin/stores?status=Inactive')->assertJsonPath('data.0.name', 'Adidas');
    }

    public function test_status_change_and_duplicate(): void
    {
        $store = Store::factory()->create(['slug' => 'nike']);

        $this->patchJson("/api/v1/admin/stores/{$store->id}/status", ['status' => 'Inactive'])
            ->assertOk()->assertJsonPath('data.status', 'Inactive');

        $this->patchJson("/api/v1/admin/stores/{$store->id}/status", ['status' => 'Bogus'])
            ->assertJsonValidationErrors('status');

        $this->postJson("/api/v1/admin/stores/{$store->id}/duplicate")
            ->assertCreated()
            ->assertJsonPath('data.slug', 'nike-copy')
            ->assertJsonPath('data.status', 'Draft');
    }

    public function test_delete_goes_to_trash_and_restore_comes_back_unpublished(): void
    {
        $store = Store::factory()->create();
        $coupon = Coupon::factory()->create();

        $this->deleteJson("/api/v1/admin/stores/{$store->id}")->assertNoContent();
        $this->deleteJson("/api/v1/admin/coupons/{$coupon->id}")->assertNoContent();

        $this->getJson('/api/v1/admin/trash')->assertOk()->assertJsonCount(2, 'data');

        $this->postJson("/api/v1/admin/trash/store/{$store->id}/restore")->assertOk();
        $this->postJson("/api/v1/admin/trash/coupon/{$coupon->id}/restore")->assertOk();

        $this->assertSame('Inactive', $store->fresh()->status->value);
        $this->assertSame('Draft', $coupon->fresh()->status->value);
    }

    public function test_sold_coupons_cannot_be_purged_from_trash(): void
    {
        $sold = Coupon::factory()->paid()->create();
        $unsold = Coupon::factory()->create();
        $order = Order::factory()->create(['status' => OrderStatus::Paid, 'total_cents' => 499]);
        $order->items()->create(['coupon_id' => $sold->id, 'title_snapshot' => 'x', 'unit_price_cents' => 499]);
        $sold->delete();
        $unsold->delete();

        $this->deleteJson("/api/v1/admin/trash/coupon/{$sold->id}")->assertStatus(409);

        $this->deleteJson('/api/v1/admin/trash')->assertOk()->assertJson(['purged' => 1, 'kept' => 1]);
        $this->assertNotNull(Coupon::withTrashed()->find($sold->id));
        $this->assertNull(Coupon::withTrashed()->find($unsold->id));
    }

    public function test_coupon_validation_rules(): void
    {
        $store = Store::factory()->create();

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'x', 'type' => 'Coupon Code', 'price_cents' => 20,
        ])->assertJsonValidationErrors(['code', 'price_cents']);

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => '20% off', 'type' => 'Coupon Code', 'code' => 'SAVE20',
            'price_cents' => 299, 'stock' => 10, 'expires_at' => now()->addWeek()->toDateString(), 'status' => 'Active',
        ])->assertCreated()->assertJsonPath('data.code', 'SAVE20')->assertJsonPath('data.price_cents', 299);
    }

    public function test_expired_coupon_filter(): void
    {
        Coupon::factory()->create();
        Coupon::factory()->expired()->create(['title' => 'Old deal']);

        $this->getJson('/api/v1/admin/coupons?expired=1')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Old deal');
    }

    public function test_publishing_a_blog_stamps_the_publish_date(): void
    {
        $category = Category::factory()->blog()->create();

        $id = $this->postJson('/api/v1/admin/blogs', ['title' => 'Fall deals', 'category_id' => $category->id, 'status' => 'Draft'])
            ->assertCreated()->assertJsonPath('data.published_at', null)->json('data.id');

        $this->patchJson("/api/v1/admin/blogs/{$id}/status", ['status' => 'Published'])->assertOk();

        $this->assertNotNull(Blog::find($id)->published_at);
    }

    public function test_blog_rejects_a_store_category(): void
    {
        $storeCategory = Category::factory()->create();

        $this->postJson('/api/v1/admin/blogs', ['title' => 'x', 'category_id' => $storeCategory->id])
            ->assertJsonValidationErrors('category_id');
    }

    public function test_category_crud(): void
    {
        $id = $this->postJson('/api/v1/admin/categories', ['type' => 'blog', 'name' => 'Money Tips'])
            ->assertCreated()->assertJsonPath('data.slug', 'money-tips')->json('data.id');

        $this->getJson('/api/v1/admin/categories?type=blog')->assertJsonPath('data.0.items_count', 0);
        $this->patchJson("/api/v1/admin/categories/{$id}", ['name' => 'Saving Tips'])->assertJsonPath('data.name', 'Saving Tips');
        $this->deleteJson("/api/v1/admin/categories/{$id}")->assertNoContent();
    }

    public function test_settings_save_per_group_and_log_what_changed(): void
    {
        $this->putJson('/api/v1/admin/settings/general', ['site_name' => 'Deal Desk'])->assertJsonPath('data.site_name', 'Deal Desk');
        $this->getJson('/api/v1/admin/settings')->assertJsonPath('data.general.site_name', 'Deal Desk');

        $log = ActivityLog::where('action', 'settings_updated')->sole();
        $this->assertSame(['site_name' => ['Coupon Follow', 'Deal Desk']], $log->changes);
        $this->assertSame('General settings', $log->subject_label);

        $this->putJson('/api/v1/admin/settings/unknown', [])->assertNotFound();

        // Requiring two-step login locks this admin (who has none) out until they set it up.
        $this->putJson('/api/v1/admin/settings/security', ['require_two_factor' => true])
            ->assertOk()->assertJsonPath('data.require_two_factor', true);
        $this->getJson('/api/v1/admin/settings')->assertForbidden()->assertJsonPath('code', 'two_factor_setup_required');
    }

    public function test_sync_runs_use_the_standard_paginated_shape(): void
    {
        SyncRun::create(['reference' => 'SYNC-1', 'type' => 'Full Sync', 'started_at' => now(), 'status' => 'Completed']);

        $this->getJson('/api/v1/admin/sync-runs')
            ->assertOk()
            ->assertJsonPath('data.0.reference', 'SYNC-1')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_redemption_summary_counts_and_totals(): void
    {
        $row = fn (string $ref, string $status, int $value) => Redemption::create([
            'reference' => $ref, 'user_name' => 'x', 'coupon_code' => 'C', 'status' => $status,
            'order_value_cents' => $value, 'commission_cents' => intdiv($value, 10),
        ]);
        $row('R1', 'Used', 10000);
        $row('R2', 'Used', 5000);
        $row('R3', 'Failed', 9999);

        $this->getJson('/api/v1/admin/redemptions/summary')
            ->assertOk()
            ->assertJson([
                'total' => 3,
                'by_status' => ['Used' => 2, 'Failed' => 1, 'Pending' => 0],
                'order_value_cents' => 15000,
                'commission_cents' => 1500,
            ]);
    }

    public function test_featured_coupon_filter(): void
    {
        Coupon::factory()->create(['is_featured' => true, 'title' => 'Hot deal']);
        Coupon::factory()->create(['is_featured' => false]);

        $this->getJson('/api/v1/admin/coupons?is_featured=1')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Hot deal');
    }

    public function test_dashboard_and_csv_export(): void
    {
        $this->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonStructure(['kpis' => ['total_stores', 'revenue_cents'], 'sales', 'top_stores', 'recent_orders', 'recent_redemptions'])
            ->assertJsonCount(30, 'sales');

        $response = $this->get('/api/v1/admin/analytics/export?days=7');
        $response->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringStartsWith('Date,"Coupon uses","Paid orders",Revenue', $response->streamedContent());
    }
}
