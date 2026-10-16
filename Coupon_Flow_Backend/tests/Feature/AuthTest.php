<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
        User::factory()->admin()->create(['email' => 'a@b.com', 'password' => 'correct-horse']);

        $this->postJson('/api/v1/auth/login', ['email' => 'a@b.com', 'password' => 'wrong'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_logout_revokes_the_token(): void
    {
        $user = User::factory()->admin()->create();
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

    public function test_profile_password_change_requires_the_current_password(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/v1/auth/profile', ['password' => 'NewPass1234', 'password_confirmation' => 'NewPass1234'])
            ->assertJsonValidationErrors('current_password');

        $this->putJson('/api/v1/auth/profile', [
            'current_password' => 'password',
            'password' => 'NewPass1234',
            'password_confirmation' => 'NewPass1234',
        ])->assertOk();
    }

    public function test_sign_in_is_rate_limited_and_the_admin_can_read_the_wait_time(): void
    {
        config(['cors.allowed_origins' => ['http://admin.test']]);
        User::factory()->admin()->create(['email' => 'admin@couponfollow.com', 'password' => 'Admin1234']);
        $attempt = fn () => $this->withHeader('Origin', 'http://admin.test')
            ->postJson('/api/v1/auth/login', ['email' => 'admin@couponfollow.com', 'password' => 'wrong']);

        for ($i = 0; $i < 10; $i++) {
            $attempt()->assertStatus(422);
        }

        // The admin turns Retry-After into "wait N seconds"; a cross-origin page only sees it when exposed.
        $response = $attempt()->assertStatus(429)->assertHeader('Retry-After');
        $this->assertStringContainsString('Retry-After', (string) $response->headers->get('Access-Control-Expose-Headers'));
    }
}
