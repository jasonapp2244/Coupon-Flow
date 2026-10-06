<?php

namespace Tests;

use App\Models\Setting;
use App\Models\User;
use App\Services\SiteSettings;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Stripe\ApiRequestor;
use Stripe\StripeClient;
use Tests\Support\FakeStripeHttpClient;

abstract class TestCase extends BaseTestCase
{
    protected const WEBHOOK_SECRET = 'whsec_test_secret';

    protected function tearDown(): void
    {
        ApiRequestor::setHttpClient(null);

        parent::tearDown();
    }

    /** Switches on selling exclusive (paid) codes, which is off by default (Settings → General). */
    protected function enableShop(bool $on = true): void
    {
        $general = Setting::where('key', 'general')->value('value') ?? [];
        Setting::updateOrCreate(['key' => 'general'], ['value' => ['shop_enabled' => $on] + $general]);
        app(SiteSettings::class)->forget();
    }

    protected function actingAsAdmin(): User
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        return $admin;
    }

    protected function actingAsCustomer(): User
    {
        $customer = User::factory()->create();
        Sanctum::actingAs($customer);

        return $customer;
    }

    protected function fakeStripe(): FakeStripeHttpClient
    {
        config([
            'services.stripe.secret' => 'rk_test_fake',
            'services.stripe.webhook_secret' => self::WEBHOOK_SECRET,
        ]);
        $this->app->forgetInstance(StripeClient::class);

        $fake = new FakeStripeHttpClient;
        ApiRequestor::setHttpClient($fake);

        return $fake;
    }

    /**
     * POST a correctly signed webhook, exactly as Stripe would send it.
     *
     * @param  array<string, mixed>  $object
     */
    protected function postStripeEvent(string $type, array $object, ?string $eventId = null, ?string $secret = null): TestResponse
    {
        $payload = json_encode([
            'id' => $eventId ?? 'evt_'.bin2hex(random_bytes(8)),
            'object' => 'event',
            'type' => $type,
            'api_version' => config('services.stripe.api_version'),
            'data' => ['object' => $object],
        ]);

        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret ?? self::WEBHOOK_SECRET);

        return $this->call('POST', '/api/stripe/webhook', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
        ], $payload);
    }
}
