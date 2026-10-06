<?php

namespace App\Providers;

use App\Models\User;
use App\Services\SiteSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Stripe\StripeClient;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One read per request (or queued job) of the admin-editable settings.
        $this->app->scoped(SiteSettings::class);

        // Resolved lazily, so the app boots (and tests run) without Stripe keys.
        $this->app->singleton(StripeClient::class, function (): StripeClient {
            $secret = config('services.stripe.secret');

            if (blank($secret)) {
                throw new ServiceUnavailableHttpException(null, 'Payments are not configured yet.');
            }

            return new StripeClient([
                'api_key' => $secret,
                'stripe_version' => config('services.stripe.api_version'),
            ]);
        });
    }

    public function boot(): void
    {
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('clicks', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
        // Feed runs fetch remote URLs and write many rows: a few per minute per person is plenty.
        RateLimiter::for('feeds', fn (Request $request) => Limit::perMinute(6)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('ratings', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('checkout', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        // The emailed link opens the website, which calls the signed API URL it carries.
        VerifyEmail::createUrlUsing(function (User $user): string {
            $api = URL::temporarySignedRoute('verification.verify', now()->addHours(24), [
                'id' => $user->getKey(),
                'hash' => sha1($user->getEmailForVerification()),
            ]);

            return config('services.frontend.public_url').'/verify-email?'.http_build_query(['link' => $api]);
        });

        // There are no Blade pages: reset links open the matching frontend.
        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            // The admin SPA uses hash routing (it can be hosted in any subfolder).
            $base = $user->isStaff()
                ? config('services.frontend.admin_url').'/#'
                : config('services.frontend.public_url');

            return $base.'/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]);
        });
    }
}
