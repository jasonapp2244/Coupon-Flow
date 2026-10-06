<?php

namespace Tests\Feature;

use App\Enums\CouponStatus;
use App\Enums\StoreStatus;
use App\Models\ActivityLog;
use App\Models\Coupon;
use App\Models\FeedSource;
use App\Models\Store;
use App\Models\SyncRun;
use App\Models\User;
use App\Notifications\AdminActivity;
use App\Services\FeedImporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Brands send coupons by feed URL or CSV; the importer adds, updates and reports bad rows. */
class FeedImportTest extends TestCase
{
    use RefreshDatabase;

    /** A public IP literal: passes the SSRF check without DNS. */
    private const FEED_URL = 'https://93.184.216.34/coupons.json';

    private function source(array $attributes = []): FeedSource
    {
        return FeedSource::create(['name' => 'Tea Brand', 'type' => 'json_url', 'url' => self::FEED_URL, ...$attributes]);
    }

    private function row(array $overrides = []): array
    {
        return [
            'external_id' => 'TLTS-10', 'store' => 'The Loaded Tea Shop', 'store_url' => 'https://theloadedteashop.com',
            'title' => 'Sitewide Discount! Get 10% Off', 'type' => 'code', 'code' => 'TLTS',
            'ends_at' => '2026-10-25 23:59', 'usage_limit' => 500, 'verified' => 'yes', ...$overrides,
        ];
    }

    public function test_a_json_feed_adds_coupons_as_drafts_and_creates_unknown_stores(): void
    {
        Http::fake([self::FEED_URL => Http::response(['coupons' => [$this->row(), $this->row(['external_id' => 'SHIP', 'type' => 'deal', 'code' => null, 'title' => 'Free Shipping'])]])]);
        $this->actingAsAdmin();
        $source = $this->source(['api_key' => 'brand-secret-key']);

        $this->postJson("/api/v1/admin/feed-sources/{$source->id}/run")->assertCreated()
            ->assertJsonPath('data.status', 'Completed')
            ->assertJsonPath('data.coupons_added', 2)
            ->assertJsonPath('data.stores_added', 1)
            ->assertJsonPath('data.feed_source', 'Tea Brand');

        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Bearer brand-secret-key'));

        $store = Store::where('slug', 'the-loaded-tea-shop')->sole();
        $this->assertSame(StoreStatus::Draft, $store->status);
        $coupon = Coupon::where('external_id', 'TLTS-10')->sole();
        $this->assertSame(CouponStatus::Draft, $coupon->status);
        $this->assertSame(500, $coupon->usage_limit);
        $this->assertTrue($coupon->is_verified);
        $this->assertSame($source->id, $coupon->feed_source_id);
        // One summary entry, not one per coupon.
        $this->assertSame(0, ActivityLog::where('subject_type', 'Coupon')->count());
        $this->assertSame(1, ActivityLog::where('action', 'feed_synced')->count());
    }

    public function test_running_again_updates_changed_coupons_but_keeps_admin_edits(): void
    {
        $source = $this->source(['auto_publish' => true]);
        Http::fake([self::FEED_URL => Http::sequence()
            ->push([$this->row(), $this->row(['external_id' => 'B', 'title' => 'Second'])])
            ->push([$this->row(['title' => 'Now 15% Off']), $this->row(['external_id' => 'B', 'title' => 'Second, renamed by brand'])])]);
        $importer = app(FeedImporter::class);

        $importer->runUrl($source);
        $this->assertSame(CouponStatus::Active, Coupon::where('external_id', 'TLTS-10')->sole()->status);

        // An admin rewrites coupon B's title on our side.
        Coupon::where('external_id', 'B')->sole()->update(['title' => 'Our better title']);

        $run = $importer->runUrl($source);
        $this->assertSame(1, $run->coupons_updated);
        $this->assertSame(1, $run->coupons_kept);
        $this->assertSame('Now 15% Off', Coupon::where('external_id', 'TLTS-10')->sole()->title);
        $this->assertSame('Our better title', Coupon::where('external_id', 'B')->sole()->title);
        $this->assertSame(2, Coupon::count());
    }

    public function test_bad_rows_are_skipped_and_listed_and_staff_are_alerted(): void
    {
        Notification::fake();
        $editor = User::factory()->editor()->create();
        Http::fake([self::FEED_URL => Http::response([
            $this->row(),
            $this->row(['external_id' => 'X1', 'code' => null]),
            $this->row(['external_id' => 'X2', 'store' => 'Unknown Brand', 'store_url' => null]),
            $this->row(['external_id' => 'X3', 'starts_at' => '2026-10-20', 'ends_at' => '2026-10-10']),
        ])]);

        $run = app(FeedImporter::class)->runUrl($this->source());

        $this->assertSame('Partial', $run->status->value);
        $this->assertSame(1, $run->coupons_added);
        $this->assertSame(3, $run->failed);
        $this->assertSame([2, 3, 4], array_column($run->errors, 'row'));
        $this->assertStringContainsString('Unknown store "Unknown Brand"', $run->errors[1]['message']);
        Notification::assertSentTo($editor, AdminActivity::class);
    }

    public function test_csv_upload_with_the_template_columns(): void
    {
        $this->actingAsAdmin();
        Store::factory()->create(['name' => 'The Loaded Tea Shop', 'slug' => 'the-loaded-tea-shop']);
        $source = $this->source(['type' => 'csv_upload', 'url' => null]);

        $file = UploadedFile::fake()->createWithContent('brand.csv', "\xEF\xBB\xBF".FeedImporter::template());
        $this->post("/api/v1/admin/feed-sources/{$source->id}/import", ['file' => $file], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.coupons_added', 2)->assertJsonPath('data.stores_added', 0);

        $coupon = Coupon::where('external_id', 'TLTS-10')->sole();
        $this->assertSame('TLTS', $coupon->code);
        $this->assertSame('2026-10-26 03:59:00', $coupon->getRawOriginal('expires_at')); // 23:59 New York
        $this->assertNull(Coupon::where('external_id', 'TLTS-SHIP')->sole()->code);

        $this->get('/api/v1/admin/feed-sources/template')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_coupons_missing_from_the_feed_are_switched_off_when_asked(): void
    {
        $source = $this->source(['auto_publish' => true, 'deactivate_missing' => true]);
        Http::fake([self::FEED_URL => Http::sequence()
            ->push([$this->row(), $this->row(['external_id' => 'B'])])
            ->push([$this->row()])
            ->push([])]);
        $importer = app(FeedImporter::class);

        $importer->runUrl($source);
        $run = $importer->runUrl($source);

        $this->assertSame(1, $run->coupons_deactivated);
        $this->assertSame(CouponStatus::Inactive, Coupon::where('external_id', 'B')->sole()->status);
        $this->assertSame(CouponStatus::Active, Coupon::where('external_id', 'TLTS-10')->sole()->status);

        // An empty feed never switches everything off.
        $importer->runUrl($source);
        $this->assertSame(CouponStatus::Active, Coupon::where('external_id', 'TLTS-10')->sole()->status);
    }

    public function test_deleted_coupons_are_not_brought_back(): void
    {
        $source = $this->source();
        Http::fake([self::FEED_URL => Http::response([$this->row()])]);
        $importer = app(FeedImporter::class);

        $importer->runUrl($source);
        Coupon::where('external_id', 'TLTS-10')->sole()->delete();
        $run = $importer->runUrl($source);

        $this->assertSame(0, $run->coupons_added);
        $this->assertSame(0, Coupon::count());
    }

    public function test_internal_and_plain_http_urls_are_refused(): void
    {
        Http::fake();
        foreach (['https://127.0.0.1/feed', 'https://10.0.0.5/feed', 'https://192.168.1.10/feed', 'http://93.184.216.34/feed'] as $url) {
            $run = app(FeedImporter::class)->runUrl($this->source(['url' => $url]));
            $this->assertSame('Failed', $run->status->value, $url);
        }
        Http::assertNothingSent();
    }

    public function test_too_many_rows_and_broken_json_fail_cleanly(): void
    {
        Http::fake([self::FEED_URL => Http::response('not json', 200, ['Content-Type' => 'application/json'])]);
        $run = app(FeedImporter::class)->runUrl($this->source());

        $this->assertSame('Failed', $run->status->value);
        $this->assertSame('The feed is not valid JSON.', $run->errors[0]['message']);
        $this->assertSame('Failed', FeedSource::first()->last_status);
    }

    public function test_the_scheduler_runs_only_due_sources(): void
    {
        Http::fake([self::FEED_URL => Http::response([$this->row()])]);
        $due = $this->source(['name' => 'Hourly', 'frequency' => 'hourly']);
        $this->source(['name' => 'Manual', 'frequency' => 'manual']);
        $recent = $this->source(['name' => 'Daily', 'frequency' => 'daily']);
        $recent->forceFill(['last_run_at' => now()->subHour()])->save();

        $this->artisan('feeds:sync')->expectsOutputToContain('Hourly: Completed')->assertSuccessful();

        $this->assertSame([$due->id], SyncRun::pluck('feed_source_id')->all());
    }

    public function test_roles_and_secret_masking_for_feed_sources(): void
    {
        $this->actingAsAdmin();
        $id = $this->postJson('/api/v1/admin/feed-sources', ['name' => 'Brand', 'type' => 'json_url', 'url' => 'https://brand.example/feed', 'api_key' => 'sk_brand_1234'])
            ->assertCreated()->assertJsonPath('data.api_key', '••••1234')->assertJsonPath('data.has_api_key', true)->json('data.id');
        $this->patchJson("/api/v1/admin/feed-sources/{$id}", ['api_key' => ''])->assertJsonPath('data.api_key', '••••1234');
        $this->postJson('/api/v1/admin/feed-sources', ['name' => 'X', 'type' => 'json_url', 'url' => 'http://insecure.example'])->assertUnprocessable();
        $this->assertStringNotContainsString('sk_brand_1234', json_encode(ActivityLog::pluck('changes')));

        Sanctum::actingAs(User::factory()->editor()->create());
        $this->getJson('/api/v1/admin/feed-sources')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/admin/feed-sources', ['name' => 'Y', 'type' => 'csv_upload'])->assertForbidden();

        Sanctum::actingAs(User::factory()->viewer()->create());
        $this->postJson("/api/v1/admin/feed-sources/{$id}/run")->assertForbidden();
    }
}
