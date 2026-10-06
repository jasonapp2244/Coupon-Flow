<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\FeedSource;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** The usage dashboard: uses, watch lists and feed health. */
class DashboardStatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_shows_uses_watch_lists_and_feed_health(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-09 15:00:00', 'UTC'));
        $this->actingAsAdmin();

        $popular = Coupon::factory()->create(['title' => 'Popular', 'usage_limit' => 10]);
        Coupon::factory()->create(['title' => 'Ending', 'expires_at' => now()->addHours(5)]);
        Coupon::factory()->create(['title' => 'Starting', 'starts_at' => now()->addDay()]);
        foreach (range(1, 8) as $_) {
            $this->get("/api/go/{$popular->id}");
        }
        FeedSource::create(['name' => 'Broken Brand', 'type' => 'json_url', 'url' => 'https://93.184.216.34/f'])
            ->forceFill(['last_status' => 'Failed', 'last_run_at' => now()])->save();

        $data = $this->getJson('/api/v1/admin/dashboard')->assertOk()->json();

        $this->assertSame(8, $data['usage']['uses_today']);
        $this->assertSame(8, $data['usage']['uses_7d']);
        $this->assertSame(1, $data['usage']['near_limit']);
        $this->assertSame(1, $data['usage']['ending_48h']);
        $this->assertSame(1, $data['usage']['scheduled']);
        $this->assertSame(1, $data['usage']['feeds_failing']);
        $this->assertSame(8, end($data['uses'])['uses']);
        $this->assertCount(30, $data['uses']);

        $this->assertSame('Popular', $data['top_coupons'][0]['title']);
        $this->assertEquals(80, $data['top_coupons'][0]['used_percent']);
        $this->assertSame('Popular', $data['watch']['near_limit'][0]['title']);
        $this->assertSame('Ending', $data['watch']['ending_soon'][0]['title']);
        $this->assertSame('Starting', $data['watch']['starting_soon'][0]['title']);
        $this->assertSame('Broken Brand', $data['feeds'][0]['name']);
        $this->assertFalse($data['shop_enabled']);
        $this->assertTrue($data['two_factor_missing']);
        $this->assertIsArray($data['recent_activity']);
    }

    public function test_viewers_see_the_numbers_but_not_the_activity_log(): void
    {
        Sanctum::actingAs(User::factory()->viewer()->create());

        $this->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('recent_activity', null);
        $this->getJson('/api/v1/admin/analytics?days=7')->assertOk()->assertJsonCount(7, 'uses');
    }
}
