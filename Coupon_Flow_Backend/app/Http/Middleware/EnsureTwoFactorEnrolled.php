<?php

namespace App\Http\Middleware;

use App\Services\SiteSettings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * When Settings → Security requires two-step login, staff without it can't use the admin API
 * until they set it up (the setup endpoints live under /auth, outside this check).
 */
class EnsureTwoFactorEnrolled
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isStaff() && ! $user->hasTwoFactor() && $this->settings->get('security', 'require_two_factor')) {
            return response()->json([
                'message' => 'Set up two-step login to keep using the admin.',
                'code' => 'two_factor_setup_required',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
