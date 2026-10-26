<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Coupon;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AdminActivity;
use App\Notifications\AdminAlertMail;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Staff-only accounts, sessions, settings safety, coupon code rules and seeding. */
class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_public_site_has_no_accounts(): void
    {
        Notification::fake();
        $shopper = User::factory()->create(['password' => 'Secret1234']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Test', 'email' => 'tauseefchoohan0401@gmail.com',
            'password' => 'Secret1234', 'password_confirmation' => 'Secret1234',
        ])->assertNotFound();
        $this->getJson("/api/v1/auth/email/verify/{$shopper->id}/".sha1($shopper->email))->assertNotFound();

        // Old shopper accounts can neither sign in nor get a reset link.
        $this->postJson('/api/v1/auth/login', ['email' => $shopper->email, 'password' => 'Secret1234'])
            ->assertUnprocessable()->assertJsonPath('errors.email.0', 'Incorrect email or password.');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $shopper->email])->assertOk();
        Notification::assertNothingSent();
    }

    public function test_staff_can_change_their_email_without_a_confirmation_link(): void
    {
        Notification::fake();
        Sanctum::actingAs($user = User::factory()->admin()->create(['password' => 'Secret1234']));

        $this->putJson('/api/v1/auth/profile', ['email' => 'new@example.com', 'current_password' => 'Secret1234'])->assertOk();

        $this->assertSame('new@example.com', $user->fresh()->email);
        Notification::assertNothingSent();
    }

    public function test_changing_password_signs_out_other_devices_but_not_this_one(): void
    {
        $user = User::factory()->admin()->create(['password' => 'Secret1234']);
        $other = $user->createToken('phone')->plainTextToken;
        $current = $user->createToken('laptop')->plainTextToken;

        $this->withToken($current)->putJson('/api/v1/auth/profile', [
            'current_password' => 'Secret1234', 'password' => 'NewSecret99', 'password_confirmation' => 'NewSecret99',
        ])->assertOk();

        $this->assertSame(['laptop'], $user->tokens()->pluck('name')->all());
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_coupon_code_type_needs_a_code_even_on_partial_update(): void
    {
        $this->actingAsAdmin();
        $store = Coupon::factory()->create()->store;

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Code', 'type' => 'Coupon Code',
        ])->assertUnprocessable()->assertJsonPath('errors.code.0', 'Enter the coupon code.');
        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Deal', 'type' => 'Deal',
        ])->assertCreated();

        $deal = Coupon::factory()->for($store)->create(['type' => 'Deal', 'code' => null]);
        $this->putJson("/api/v1/admin/coupons/{$deal->id}", ['type' => 'Coupon Code'])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->putJson("/api/v1/admin/coupons/{$deal->id}", ['type' => 'Coupon Code', 'code' => 'VIP299'])->assertOk();
    }

    public function test_settings_drop_retired_fields_and_groups(): void
    {
        $this->actingAsAdmin();
        // Retired: the single-vendor group, the shop switch, the payment problem alerts and the old currency field.
        Setting::create(['key' => 'vendor', 'value' => ['api_key' => 'eyJpdiI6ImJyb2tlbiJ9']]);
        Setting::create(['key' => 'general', 'value' => ['site_name' => 'Shop', 'currency' => 'EUR', 'shop_enabled' => true]]);
        Setting::create(['key' => 'notifications', 'value' => ['email' => true, 'error_alerts' => true]]);

        $this->getJson('/api/v1/admin/settings')->assertOk()
            ->assertJsonMissingPath('data.vendor')
            ->assertJsonMissingPath('data.general.currency')
            ->assertJsonMissingPath('data.general.shop_enabled')
            ->assertJsonMissingPath('data.notifications.error_alerts')
            ->assertJsonMissingPath('meta.currency')
            ->assertJsonPath('data.security.require_two_factor', false);
        $this->putJson('/api/v1/admin/settings/vendor', ['api_key' => 'x'])->assertNotFound();
    }

    public function test_alerts_are_emailed_only_when_the_switches_are_on(): void
    {
        Notification::fake();
        $admin = User::factory()->admin()->create();

        AdminActivity::broadcast('Feed failed', 'sync_alerts');
        Notification::assertSentTo($admin, AdminAlertMail::class);

        Setting::create(['key' => 'notifications', 'value' => ['email' => false]]);
        $this->app->forgetScopedInstances();
        Notification::fake();

        AdminActivity::broadcast('Feed failed again', 'sync_alerts');
        Notification::assertSentTo($admin, AdminActivity::class);
        Notification::assertNotSentTo($admin, AdminAlertMail::class);
    }

    public function test_reset_links_open_the_admin(): void
    {
        Notification::fake();
        config(['services.frontend.admin_url' => 'https://admin.test']);
        $editor = User::factory()->editor()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $editor->email])->assertOk();

        Notification::assertSentTo($editor, ResetPassword::class,
            fn (ResetPassword $n) => str_starts_with($n->toMail($editor)->actionUrl, 'https://admin.test/#/reset-password?token='));
    }

    public function test_production_seeding_creates_only_the_super_admin(): void
    {
        config(['services.admin.email' => 'owner@shop.test', 'services.admin.password' => 'Str0ngPass!']);
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

        $this->assertSame(['owner@shop.test'], User::pluck('email')->all());
        $this->assertSame(Role::SuperAdmin, User::sole()->role);
        $this->assertSame(0, Coupon::count());
    }

    public function test_local_seeding_adds_demo_data_only_once(): void
    {
        config(['services.admin.password' => 'Admin1234']);

        $this->seed(DatabaseSeeder::class);
        $coupons = Coupon::count();
        $this->seed(DatabaseSeeder::class);

        $this->assertGreaterThan(0, $coupons);
        $this->assertSame($coupons, Coupon::count());
        $this->assertSame(1, User::count());
    }
}
