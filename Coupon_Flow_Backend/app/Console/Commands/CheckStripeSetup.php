<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Stripe\Exception\ApiErrorException;
use Stripe\Exception\PermissionException;
use Stripe\StripeClient;

/**
 * Go-live checklist for payments: confirms the keys work and the webhook is wired
 * before real customers reach checkout. Exits non-zero when something would break payments.
 */
class CheckStripeSetup extends Command
{
    /** Events StripeWebhookHandler acts on; the Dashboard endpoint must send all of them. */
    public const WEBHOOK_EVENTS = [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed',
        'checkout.session.expired',
        'charge.refunded',
        'charge.dispute.created',
    ];

    protected $signature = 'stripe:check';

    protected $description = 'Check Stripe keys, webhook and payment-related settings before going live';

    private int $failures = 0;

    public function handle(): int
    {
        $secret = (string) config('services.stripe.secret');
        $live = app()->isProduction();

        $this->checkKey($secret, $live);
        $this->checkWebhookSecret((string) config('services.stripe.webhook_secret'));
        $this->checkSettings($live);

        if ($secret !== '') {
            $this->checkApi(app(StripeClient::class), $secret);
        }

        $this->newLine();

        if ($this->failures > 0) {
            $this->error("{$this->failures} problem(s) must be fixed before taking payments.");

            return self::FAILURE;
        }

        $this->info('Payments are ready.');

        return self::SUCCESS;
    }

    private function checkKey(string $secret, bool $live): void
    {
        if ($secret === '') {
            $this->problem('STRIPE_SECRET is empty.');

            return;
        }

        if (! preg_match('/^(rk|sk)[a-z]*_(test|live)_/', $secret, $m)) {
            $this->problem('STRIPE_SECRET does not look like a Stripe secret or restricted key.');

            return;
        }

        [$kind, $mode] = [$m[1], $m[2]];

        $this->ok(($kind === 'rk' ? 'Restricted' : 'Secret')." key in {$mode} mode.");

        if ($kind === 'sk') {
            $this->warn('  ! A restricted key (rk_) limited to Checkout Sessions and Refunds is safer than a full secret key.');
        }

        if ($live && $mode === 'test') {
            $this->problem('Production is using a test key: customers cannot pay real money.');
        }

        if (! $live && $mode === 'live') {
            $this->problem('A live key is configured outside production: test purchases would charge real cards.');
        }
    }

    private function checkWebhookSecret(string $webhookSecret): void
    {
        if (! str_starts_with($webhookSecret, 'whsec_')) {
            $this->problem('STRIPE_WEBHOOK_SECRET is missing: paid orders would never deliver their codes.');

            return;
        }

        $this->ok('Webhook signing secret is set.');
    }

    private function checkSettings(bool $live): void
    {
        $currency = (string) config('services.stripe.currency');
        preg_match('/^[a-z]{3}$/', $currency)
            ? $this->ok('Store currency: '.strtoupper($currency).'.')
            : $this->problem("STORE_CURRENCY \"{$currency}\" is not a three-letter currency code.");

        if (! $live) {
            return;
        }

        foreach (['app.url' => 'APP_URL', 'services.frontend.public_url' => 'FRONTEND_URL', 'services.frontend.admin_url' => 'ADMIN_URL'] as $key => $env) {
            str_starts_with((string) config($key), 'https://')
                ? $this->ok("{$env} uses HTTPS.")
                : $this->problem("{$env} must use HTTPS in production.");
        }

        config('app.debug')
            ? $this->problem('APP_DEBUG must be false in production.')
            : $this->ok('Debug mode is off.');

        in_array(config('mail.default'), ['log', 'array'], true)
            ? $this->problem('MAIL_MAILER is "'.config('mail.default').'": customers would not receive their codes by email.')
            : $this->ok('Order emails are sent with the "'.config('mail.default').'" mailer.');
    }

    private function checkApi(StripeClient $stripe, string $secret): void
    {
        try {
            $stripe->checkout->sessions->all(['limit' => 1]);
            $this->ok('Stripe accepted the key and it can read Checkout Sessions.');
        } catch (ApiErrorException $e) {
            $this->problem("Stripe rejected the key: {$e->getMessage()}");

            return;
        }

        try {
            $endpoints = $stripe->webhookEndpoints->all(['limit' => 100]);
        } catch (PermissionException) {
            $this->warn('  ! The key cannot read webhook endpoints; check the events in the Dashboard by hand: '.implode(', ', self::WEBHOOK_EVENTS));

            return;
        } catch (ApiErrorException $e) {
            $this->warn("  ! Could not list webhook endpoints: {$e->getMessage()}");

            return;
        }

        $url = rtrim((string) config('app.url'), '/').'/api/stripe/webhook';
        $endpoint = collect($endpoints->data)->first(fn ($e) => $e->url === $url);

        if (! $endpoint) {
            // Locally the CLI (`stripe listen`) forwards events instead of a Dashboard endpoint.
            str_contains($secret, '_live_')
                ? $this->problem("No webhook endpoint points to {$url}.")
                : $this->warn("  ! No Dashboard webhook points to {$url}; locally use `stripe listen --events ".implode(',', self::WEBHOOK_EVENTS)." --forward-to {$url}`.");

            return;
        }

        if ($endpoint->status !== 'enabled') {
            $this->problem("The webhook endpoint for {$url} is {$endpoint->status}.");
        }

        $events = $endpoint->enabled_events ?? [];
        $missing = in_array('*', $events, true) ? [] : array_diff(self::WEBHOOK_EVENTS, $events);

        $missing
            ? $this->problem('The webhook endpoint is missing events: '.implode(', ', $missing).'.')
            : $this->ok("Webhook endpoint {$url} receives every event the shop needs.");
    }

    private function ok(string $message): void
    {
        $this->line("  <info>✓</info> {$message}");
    }

    private function problem(string $message): void
    {
        $this->failures++;
        $this->line("  <error>✗</error> {$message}");
    }
}
