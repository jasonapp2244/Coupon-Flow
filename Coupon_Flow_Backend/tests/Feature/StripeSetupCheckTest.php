<?php

namespace Tests\Feature;

use App\Console\Commands\CheckStripeSetup;
use Tests\TestCase;

class StripeSetupCheckTest extends TestCase
{
    private function endpoint(array $events, string $status = 'enabled'): array
    {
        return ['object' => 'list', 'data' => [[
            'id' => 'we_1', 'object' => 'webhook_endpoint', 'status' => $status,
            'url' => rtrim(config('app.url'), '/').'/api/stripe/webhook', 'enabled_events' => $events,
        ]]];
    }

    public function test_missing_keys_fail_without_calling_stripe(): void
    {
        config(['services.stripe.secret' => '', 'services.stripe.webhook_secret' => '']);

        $this->artisan('stripe:check')
            ->expectsOutputToContain('STRIPE_SECRET is empty.')
            ->expectsOutputToContain('STRIPE_WEBHOOK_SECRET is missing')
            ->assertFailed();
    }

    public function test_working_test_key_and_complete_webhook_pass(): void
    {
        $stripe = $this->fakeStripe()
            ->respond('GET', '/v1/checkout/sessions', ['object' => 'list', 'data' => []])
            ->respond('GET', '/v1/webhook_endpoints', $this->endpoint(CheckStripeSetup::WEBHOOK_EVENTS));

        $this->artisan('stripe:check')
            ->expectsOutputToContain('Restricted key in test mode.')
            ->expectsOutputToContain('receives every event the shop needs')
            ->expectsOutputToContain('Payments are ready.')
            ->assertSuccessful();

        $this->assertCount(2, $stripe->requests);
    }

    public function test_webhook_missing_events_is_a_problem(): void
    {
        $this->fakeStripe()
            ->respond('GET', '/v1/checkout/sessions', ['object' => 'list', 'data' => []])
            ->respond('GET', '/v1/webhook_endpoints', $this->endpoint(['checkout.session.completed']));

        $this->artisan('stripe:check')
            ->expectsOutputToContain('missing events: checkout.session.async_payment_succeeded')
            ->assertFailed();
    }

    public function test_rejected_key_is_reported(): void
    {
        $this->fakeStripe()->respond('GET', '/v1/checkout/sessions', [
            'error' => ['message' => 'Invalid API Key provided', 'type' => 'invalid_request_error'],
        ], 401);

        $this->artisan('stripe:check')
            ->expectsOutputToContain('Stripe rejected the key: Invalid API Key provided')
            ->assertFailed();
    }

    public function test_live_key_outside_production_is_refused(): void
    {
        $this->fakeStripe()
            ->respond('GET', '/v1/checkout/sessions', ['object' => 'list', 'data' => []])
            ->respond('GET', '/v1/webhook_endpoints', $this->endpoint(CheckStripeSetup::WEBHOOK_EVENTS));
        config(['services.stripe.secret' => 'rk_live_fake']);

        $this->artisan('stripe:check')
            ->expectsOutputToContain('A live key is configured outside production')
            ->assertFailed();
    }

    public function test_production_requires_https_real_mail_and_no_debug(): void
    {
        $this->fakeStripe()
            ->respond('GET', '/v1/checkout/sessions', ['object' => 'list', 'data' => []])
            ->respond('GET', '/v1/webhook_endpoints', $this->endpoint(CheckStripeSetup::WEBHOOK_EVENTS));
        $this->app->detectEnvironment(fn () => 'production');
        config([
            'services.stripe.secret' => 'rk_live_fake',
            'app.url' => 'http://api.example.com',
            'app.debug' => true,
            'mail.default' => 'log',
        ]);

        $this->artisan('stripe:check')
            ->expectsOutputToContain('APP_URL must use HTTPS in production.')
            ->expectsOutputToContain('APP_DEBUG must be false in production.')
            ->expectsOutputToContain('MAIL_MAILER is "log"')
            ->assertFailed();
    }
}
