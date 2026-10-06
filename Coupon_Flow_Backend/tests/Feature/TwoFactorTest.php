<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\User;
use App\Services\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/** Two-step login for staff: set up with an authenticator app, then a code at every sign-in. */
class TwoFactorTest extends TestCase
{
    use RefreshDatabase;

    private function code(string $secret, int $offsetSteps = 0): string
    {
        $google = new Google2FA;

        return $google->oathTotp($secret, $google->getTimestamp() + $offsetSteps);
    }

    /** Turns two-step login on for $user through the real endpoints; returns [secret, recovery codes]. */
    private function enable(User $user): array
    {
        Sanctum::actingAs($user);
        $secret = $this->postJson('/api/v1/auth/two-factor/setup')->assertOk()
            ->assertJsonStructure(['secret', 'otpauth_url', 'qr_svg'])->json('secret');

        $codes = $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => $this->code($secret)])
            ->assertOk()->assertJsonCount(10, 'recovery_codes')->json('recovery_codes');

        return [$secret, $codes];
    }

    private function signOut(): void
    {
        $this->app['auth']->forgetGuards();
    }

    public function test_setup_needs_a_correct_first_code_and_the_secret_is_stored_encrypted(): void
    {
        $admin = $this->actingAsAdmin();
        $secret = $this->postJson('/api/v1/auth/two-factor/setup')->json('secret');

        $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => '000000'])->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->assertFalse($admin->fresh()->hasTwoFactor());

        $this->postJson('/api/v1/auth/two-factor/confirm', ['code' => $this->code($secret)])->assertOk();
        $this->assertTrue($admin->fresh()->hasTwoFactor());
        $this->assertStringNotContainsString($secret, (string) DB::table('users')->where('id', $admin->id)->value('two_factor_secret'));
        $this->getJson('/api/v1/auth/me')->assertJsonPath('data.two_factor', true);
        $this->assertTrue(ActivityLog::where('action', 'two_factor_enabled')->exists());
    }

    public function test_sign_in_asks_for_the_code_and_only_then_gives_a_token(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@staff.test']);
        [$secret] = $this->enable($admin);
        $this->signOut();

        $login = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password', 'device_name' => 'admin-dashboard'])
            ->assertOk()->assertJsonPath('two_factor', true)->assertJsonMissingPath('token');
        $challenge = $login->json('challenge');

        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'code' => '123456'])->assertUnprocessable();

        // Clock one step ahead: still accepted (phones drift).
        $token = $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'code' => $this->code($secret, 1)])
            ->assertOk()->assertJsonPath('user.role', 'admin')->json('token');
        $this->assertNotEmpty($token);

        // The ticket is single-use.
        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'code' => $this->code($secret, 1)])->assertUnprocessable();
        $this->assertNotNull($admin->fresh()->last_login_at);
    }

    public function test_a_code_cannot_be_used_twice(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@staff.test']);
        [$secret] = $this->enable($admin);
        $this->signOut();

        $code = $this->code($secret, 1);
        $first = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->json('challenge');
        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $first, 'code' => $code])->assertOk();

        $second = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->json('challenge');
        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $second, 'code' => $code])->assertUnprocessable();
    }

    public function test_five_wrong_codes_end_the_sign_in(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@staff.test']);
        [$secret] = $this->enable($admin);
        $this->signOut();

        $challenge = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->json('challenge');
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'code' => '000000']);
        }

        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'code' => $this->code($secret)])
            ->assertUnprocessable()->assertJsonValidationErrors('challenge');
    }

    public function test_recovery_codes_work_once(): void
    {
        $admin = User::factory()->admin()->create(['email' => 'boss@staff.test']);
        [, $codes] = $this->enable($admin);
        $this->signOut();

        $challenge = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->json('challenge');
        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $challenge, 'recovery_code' => strtoupper($codes[0])])->assertOk();

        $again = $this->postJson('/api/v1/auth/login', ['email' => 'boss@staff.test', 'password' => 'password'])->json('challenge');
        $this->postJson('/api/v1/auth/two-factor', ['challenge' => $again, 'recovery_code' => $codes[0]])->assertUnprocessable();

        $this->assertCount(9, $admin->fresh()->two_factor_recovery_codes);
        $this->assertTrue(ActivityLog::where('action', 'recovery_code_used')->exists());
    }

    public function test_turning_it_off_needs_the_password(): void
    {
        $admin = User::factory()->admin()->create();
        $this->enable($admin);

        $this->deleteJson('/api/v1/auth/two-factor', ['password' => 'wrong'])->assertUnprocessable();
        $this->deleteJson('/api/v1/auth/two-factor', ['password' => 'password'])->assertOk();
        $this->assertFalse($admin->fresh()->hasTwoFactor());
        $this->assertNull($admin->fresh()->two_factor_secret);
    }

    public function test_admin_resets_a_lost_phone_and_shoppers_cannot_use_two_factor(): void
    {
        $editor = User::factory()->editor()->create();
        $this->enable($editor);
        $editor->createToken('admin-dashboard');

        $this->actingAsAdmin();
        $this->deleteJson("/api/v1/admin/staff/{$editor->id}/two-factor")->assertOk()->assertJsonPath('data.two_factor', false);
        $this->assertSame(0, $editor->tokens()->count());
        $this->assertTrue(ActivityLog::where('action', 'two_factor_reset')->exists());

        $this->actingAsCustomer();
        $this->postJson('/api/v1/auth/two-factor/setup')->assertForbidden();
    }

    public function test_requiring_two_factor_blocks_staff_until_they_set_it_up(): void
    {
        Setting::create(['key' => 'security', 'value' => ['require_two_factor' => true]]);
        app(SiteSettings::class)->forget();
        $viewer = User::factory()->viewer()->create();
        Sanctum::actingAs($viewer);

        $this->getJson('/api/v1/admin/dashboard')->assertForbidden()->assertJsonPath('code', 'two_factor_setup_required');
        // Setup itself stays reachable.
        $this->getJson('/api/v1/auth/two-factor')->assertOk()->assertJsonPath('enabled', false);

        $this->enable($viewer);
        $this->getJson('/api/v1/admin/dashboard')->assertOk();
    }
}
