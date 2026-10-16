<?php

namespace App\Providers;

use App\Models\User;
use App\Services\SiteSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // One read per request (or queued job) of the admin-editable settings.
        $this->app->scoped(SiteSettings::class);
    }

    public function boot(): void
    {
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        // Generous: one page makes several calls, and many shoppers can share one address (offices, mobile networks).
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(300)->by($request->ip()));
        RateLimiter::for('clicks', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));
        // Feed runs fetch remote URLs and write many rows: a few per minute per person is plenty.
        RateLimiter::for('feeds', fn (Request $request) => Limit::perMinute(6)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('ratings', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // There are no Blade pages: reset links (staff only) open the admin, which uses hash
        // routing so it can be hosted in any subfolder.
        ResetPassword::createUrlUsing(fn (User $user, string $token): string => config('services.frontend.admin_url')
            .'/#/reset-password?'.http_build_query(['token' => $token, 'email' => $user->email]));
    }
}
