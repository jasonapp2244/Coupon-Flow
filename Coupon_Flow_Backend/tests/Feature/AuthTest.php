<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_log_in_and_receives_a_token(): void
    {
        User::factory()->admin()->create(['email' => 'admin@couponfollow.com', 'password' => 'Admin1234']);

        $this->postJson('/api/v1/auth/login', ['email' => 'admin@couponfollow.com', 'password' => 'Admin1234'])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']]);
    }

    public function test_wrong_password_is_rejected(): void
    {
        User::factory()->create(['email' => 'a@b.com', 'password' => 'correct-horse']);

        $this->postJson('/api/v1/auth/login', ['email' => 'a@b.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_registration_always_creates_a_customer_even_if_role_is_sent(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Test Customer',
            'email' => 'tauseefchoohan0401@gmail.com',
            'password' => 'Customer1234',
            'password_confirmation' => 'Customer1234',
            'role' => 'admin',
        ])->assertCreated()->assertJsonPath('user.role', 'customer');

        $this->assertSame('customer', User::where('email', 'tauseefchoohan0401@gmail.com')->first()->role->value);
    }

    public function test_reset_links_point_to_the_matching_frontend(): void
    {
        Notification::fake();
        config(['services.frontend.admin_url' => 'https://admin.test', 'services.frontend.public_url' => 'https://shop.test']);
        $admin = User::factory()->admin()->create();
        $customer = User::factory()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $admin->email])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $customer->email])->assertOk();

        Notification::assertSentTo($admin, ResetPassword::class, fn ($n) => str_starts_with($n->toMail($admin)->actionUrl, 'https://admin.test/#/reset-password?token='));
        Notification::assertSentTo($customer, ResetPassword::class, fn ($n) => str_starts_with($n->toMail($customer)->actionUrl, 'https://shop.test/reset-password?token='));
    }

    public function test_logout_revokes_the_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('api')->plainTextToken;

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_guests_get_401_and_customers_get_403_on_admin_routes(): void
    {
        $this->getJson('/api/v1/admin/stores')->assertUnauthorized();

        $this->actingAsCustomer();
        $this->getJson('/api/v1/admin/stores')->assertForbidden();
    }

    public function test_admins_cannot_use_the_customer_checkout(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/checkout', ['coupon_ids' => [1]])->assertForbidden();
    }

    public function test_profile_password_change_requires_the_current_password(): void
    {
        $this->actingAsCustomer();

        $this->putJson('/api/v1/auth/profile', ['password' => 'NewPass1234', 'password_confirmation' => 'NewPass1234'])
            ->assertJsonValidationErrors('current_password');

        $this->putJson('/api/v1/auth/profile', [
            'current_password' => 'password',
            'password' => 'NewPass1234',
            'password_confirmation' => 'NewPass1234',
        ])->assertOk();
    }
}
