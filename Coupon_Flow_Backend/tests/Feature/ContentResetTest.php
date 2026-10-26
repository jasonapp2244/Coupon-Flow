<?php

namespace Tests\Feature;

use App\Models\Blog;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Redemption;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** content:reset empties a site for hand-over, leaving one admin to sign in with. */
class ContentResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config(['services.admin.email' => 'owner@shop.test', 'services.admin.password' => 'Str0ngPass!']);
        $this->seed(DatabaseSeeder::class);
    }

    public function test_it_removes_all_content_and_every_other_account(): void
    {
        User::factory()->editor()->create();
        Store::first()->delete(); // one in the trash too
        Setting::updateOrCreate(['key' => 'general'], ['value' => ['site_name' => 'Demo Deals']]);
        Storage::disk('public')->put('stores/logo.png', 'x');
        Storage::disk('public')->put('homepage/hero.jpg', 'x');
        $this->assertGreaterThan(0, Coupon::count());

        $this->artisan('content:reset', ['--keep-admin' => 'owner@shop.test', '--force' => true])->assertSuccessful();

        $this->assertSame(['owner@shop.test'], User::pluck('email')->all());
        $this->assertSame(0, Store::withTrashed()->count());
        $this->assertSame(0, Coupon::withTrashed()->count());
        $this->assertSame(0, Blog::withTrashed()->count());
        $this->assertSame(0, Category::count());
        $this->assertSame(0, Redemption::count());
        $this->assertSame(0, Setting::count());
        $this->assertSame([], Storage::disk('public')->allFiles());

        $this->getJson('/api/v1/public/settings')->assertOk()->assertJsonPath('data.site_name', 'Urban Goods Guide');
        $this->postJson('/api/v1/auth/login', ['email' => 'owner@shop.test', 'password' => 'Str0ngPass!'])->assertOk();
    }

    public function test_it_needs_an_existing_admin_to_keep(): void
    {
        $editor = User::factory()->editor()->create();

        $this->artisan('content:reset', ['--keep-admin' => 'nobody@shop.test', '--force' => true])->assertFailed();
        $this->artisan('content:reset', ['--keep-admin' => $editor->email, '--force' => true])->assertFailed();
        $this->artisan('content:reset', ['--force' => true])->assertFailed();

        $this->assertGreaterThan(0, Coupon::count());
    }

    public function test_production_needs_force(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('content:reset', ['--keep-admin' => 'owner@shop.test'])->assertFailed();

        $this->assertGreaterThan(0, Coupon::count());
    }
}
