<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Coupon;
use App\Models\Setting;
use App\Models\User;
use App\Notifications\AdminActivity;
use App\Notifications\AdminAlertMail;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Email verification, sessions, settings safety, paid-coupon rules and production seeding. */
class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_emails_a_link_to_the_website_that_verifies_the_address(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Test Customer', 'email' => 'tauseefchoohan0401@gmail.com',
            'password' => 'Secret1234', 'password_confirmation' => 'Secret1234',
        ])->assertCreated()->assertJsonPath('user.email_verified', false);

        $user = User::sole();
        $link = null;
        Notification::assertSentTo($user, VerifyEmail::class, function (VerifyEmail $n) use ($user, &$link) {
            $link = $n->toMail($user)->actionUrl;

            return true;
        });

        $this->assertStringStartsWith(config('services.frontend.public_url').'/verify-email?link=', $link);
        parse_str((string) parse_url($link, PHP_URL_QUERY), $query);

        $this->getJson($query['link'])->assertOk()->assertJsonPath('message', 'Email confirmed.');
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_tampered_verification_link_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();

        $this->getJson("/api/v1/auth/email/verify/{$user->id}/".sha1($user->email).'?signature=forged')->assertForbidden();
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_changing_email_requires_confirming_the_new_address(): void
    {
        Notification::fake();
        Sanctum::actingAs($user = User::factory()->create(['password' => 'Secret1234']));

        $this->putJson('/api/v1/auth/profile', ['email' => 'new@example.com', 'current_password' => 'Secret1234'])->assertOk();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_changing_password_signs_out_other_devices_but_not_this_one(): void
    {
        $user = User::factory()->create(['password' => 'Secret1234']);
        $other = $user->createToken('phone')->plainTextToken;
        $current = $user->createToken('laptop')->plainTextToken;

        $this->withToken($current)->putJson('/api/v1/auth/profile', [
            'current_password' => 'Secret1234', 'password' => 'NewSecret99', 'password_confirmation' => 'NewSecret99',
        ])->assertOk();

        $this->assertSame(['laptop'], $user->tokens()->pluck('name')->all());
        $this->app['auth']->forgetGuards();
        $this->withToken($other)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_paid_coupon_needs_a_code_even_as_a_deal_and_on_partial_update(): void
    {
        $this->actingAsAdmin();
        $store = Coupon::factory()->create()->store;

        $this->postJson('/api/v1/admin/coupons', [
            'store_id' => $store->id, 'title' => 'Paid deal', 'type' => 'Deal', 'price_cents' => 199,
        ])->assertUnprocessable()->assertJsonPath('errors.code.0', 'A paid coupon needs a code: it is what the buyer receives.');

        $deal = Coupon::factory()->for($store)->create(['type' => 'Deal', 'code' => null]);
        $this->putJson("/api/v1/admin/coupons/{$deal->id}", ['price_cents' => 299])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->putJson("/api/v1/admin/coupons/{$deal->id}", ['price_cents' => 299, 'code' => 'VIP299'])->assertOk();
    }

    public function test_settings_drop_retired_fields_and_groups(): void
    {
        $this->actingAsAdmin();
        // The single-vendor group was replaced by brand feeds; old rows are ignored, never sent back.
        Setting::create(['key' => 'vendor', 'value' => ['api_key' => 'eyJpdiI6ImJyb2tlbiJ9']]);
        Setting::create(['key' => 'general', 'value' => ['site_name' => 'Shop', 'currency' => 'EUR']]);

        $this->getJson('/api/v1/admin/settings')->assertOk()
            ->assertJsonMissingPath('data.vendor')
            ->assertJsonMissingPath('data.general.currency')
            ->assertJsonPath('data.security.require_two_factor', false)
            ->assertJsonPath('meta.currency', 'USD');
        $this->putJson('/api/v1/admin/settings/vendor', ['api_key' => 'x'])->assertNotFound();
    }

    public function test_sales_alerts_are_emailed_only_when_the_switches_are_on(): void
    {
        Notification::fake();
        $admin = User::factory()->admin()->create();

        AdminActivity::broadcast('Order #1 paid', 'email');
        Notification::assertSentTo($admin, AdminAlertMail::class);

        Setting::create(['key' => 'notifications', 'value' => ['email' => false]]);
        $this->app->forgetScopedInstances();
        Notification::fake();

        AdminActivity::broadcast('Order #2 paid', 'email');
        Notification::assertSentTo($admin, AdminActivity::class);
        Notification::assertNotSentTo($admin, AdminAlertMail::class);
    }

    public function test_production_seeding_creates_only_the_admin(): void
    {
        config(['services.admin.email' => 'owner@shop.test', 'services.admin.password' => 'Str0ngPass!']);
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

        $this->assertSame(['owner@shop.test'], User::pluck('email')->all());
        $this->assertSame(Role::Admin, User::sole()->role);
        $this->assertSame(0, Coupon::count());
    }

    public function test_local_seeding_adds_demo_data_and_the_test_customer(): void
    {
        config(['services.admin.password' => 'Admin1234']);

        $this->seed(DatabaseSeeder::class);

        $this->assertTrue(User::where('email', 'tauseefchoohan0401@gmail.com')->exists());
        $this->assertGreaterThan(0, Coupon::count());
    }
}
