<?php

namespace App\Http\Middleware;

use App\Enums\Role;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `role:admin` or `role:admin,editor`: the signed-in user must have one of the listed roles.
 * A super admin passes every role check.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $allowed = array_map(fn (string $role) => Role::from($role), $roles);

        $role = $request->user()?->role;
        if ($role !== Role::SuperAdmin && ! in_array($role, $allowed, true)) {
            abort(Response::HTTP_FORBIDDEN, 'Your role does not allow this.');
        }

        return $next($request);
    }
}
