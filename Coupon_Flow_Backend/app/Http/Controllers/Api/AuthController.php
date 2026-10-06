<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Audit;
use App\Services\TwoFactor;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** device_name the admin dashboard signs in with. */
    private const ADMIN_DEVICE = 'admin-dashboard';

    public function login(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', $data['email'])->first();
        $device = $data['device_name'] ?? 'api';

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Failed staff / admin-dashboard sign-ins go to the activity log; shoppers' don't.
            if ($user?->isStaff() || $device === self::ADMIN_DEVICE) {
                Audit::log('login_failed', $user, ['email' => $data['email']], label: $data['email'], actor: null);
            }
            throw ValidationException::withMessages(['email' => 'Incorrect email or password.']);
        }

        if ($user->isDisabled()) {
            throw ValidationException::withMessages(['email' => 'This account has been switched off. Ask an admin to turn it back on.']);
        }

        if ($user->isStaff() && $user->hasTwoFactor()) {
            return response()->json(['two_factor' => true, 'challenge' => $twoFactor->startChallenge($user, $device)]);
        }

        return $this->signIn($user, $device);
    }

    /** Second step for staff with two-step login: the 6-digit app code, or a recovery code. */
    public function twoFactorChallenge(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $data = $request->validate([
            'challenge' => ['required', 'string', 'max:100'],
            'code' => ['required_without:recovery_code', 'nullable', 'string', 'max:10'],
            'recovery_code' => ['required_without:code', 'nullable', 'string', 'max:30'],
        ]);

        $challenge = $twoFactor->challenge($data['challenge']);
        $user = $challenge ? User::find($challenge['user_id']) : null;
        if (! $user || $user->isDisabled() || ! $user->hasTwoFactor()) {
            throw ValidationException::withMessages(['challenge' => 'This sign-in has expired. Enter your email and password again.']);
        }

        $ok = filled($data['recovery_code'] ?? null)
            ? $twoFactor->useRecoveryCode($user, $data['recovery_code'])
            : $twoFactor->verify($user, (string) $data['code']);

        if (! $ok) {
            $twoFactor->failChallenge($data['challenge']);
            Audit::log('two_factor_failed', $user, label: $user->email, actor: $user);
            throw ValidationException::withMessages([filled($data['recovery_code'] ?? null) ? 'recovery_code' : 'code' => 'That code is not right. Try the newest code in your app.']);
        }

        $twoFactor->endChallenge($data['challenge']);
        if (filled($data['recovery_code'] ?? null)) {
            Audit::log('recovery_code_used', $user, ['codes_left' => $twoFactor->remainingRecoveryCodes($user)], label: $user->email, actor: $user);
        }

        return $this->signIn($user, $challenge['device']);
    }

    private function signIn(User $user, string $device): JsonResponse
    {
        if ($user->isStaff()) {
            $user->forceFill(['last_login_at' => now()])->save();
            Audit::log('login', $user, label: $user->email, actor: $user);
        }

        return $this->tokenResponse($user, $device);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $user = new User($data);
        $user->role = Role::Customer;
        $user->save();
        // Codes are emailed after purchase, so the address is confirmed before checkout.
        $user->sendEmailVerificationNotification();

        return $this->tokenResponse($user, 'api', 201);
    }

    /** Opened from the emailed link (via the website); the signed URL is the proof, no sign-in needed. */
    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        abort_unless(hash_equals(sha1($user->getEmailForVerification()), $hash), 403, 'This verification link is not valid.');

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        return response()->json(['message' => 'Email confirmed.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already confirmed.']);
        }

        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'We sent a new confirmation link to '.$request->user()->email.'.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        if ($request->user()->isStaff()) {
            Audit::log('logout', $request->user(), label: $request->user()->email);
        }
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($request->only('email'));

        // Same response whether or not the account exists, so emails cannot be enumerated.
        return response()->json(['message' => 'If that email is registered, a reset link has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => __($status)]);
    }

    private function tokenResponse(User $user, string $device, int $status = 200): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken($device)->plainTextToken,
            'user' => new UserResource($user),
        ], $status);
    }
}
