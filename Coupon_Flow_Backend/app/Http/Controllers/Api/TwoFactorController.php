<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Audit;
use App\Services\TwoFactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;

/** A staff member turns their own two-step login on or off and manages recovery codes. */
class TwoFactorController extends Controller
{
    private const PENDING_MINUTES = 15;

    public function status(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $user->hasTwoFactor(),
            'confirmed_at' => $user->two_factor_confirmed_at?->toIso8601String(),
            'recovery_codes_left' => $user->hasTwoFactor() ? $twoFactor->remainingRecoveryCodes($user) : 0,
        ]);
    }

    /** Step 1: a new secret and its QR code. Nothing changes until the first code is confirmed. */
    public function setup(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $user = $request->user();
        abort_if($user->hasTwoFactor(), 409, 'Two-step login is already on. Turn it off first to move it to a new phone.');

        $secret = $twoFactor->newSecret();
        Cache::put($this->pendingKey($user->id), encrypt($secret), now()->addMinutes(self::PENDING_MINUTES));
        $url = $twoFactor->otpauthUrl($user, $secret);

        return response()->json(['secret' => $secret, 'otpauth_url' => $url, 'qr_svg' => $twoFactor->qrSvg($url)]);
    }

    /** Step 2: the first code from the app proves it was added; recovery codes are shown once. */
    public function confirm(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:10']]);
        $user = $request->user();
        abort_if($user->hasTwoFactor(), 409, 'Two-step login is already on.');

        $pending = Cache::get($this->pendingKey($user->id));
        if (! $pending) {
            throw ValidationException::withMessages(['code' => 'The setup timed out. Start again to get a new QR code.']);
        }

        $secret = decrypt($pending);
        if (! $twoFactor->verify($user, $data['code'], $secret)) {
            throw ValidationException::withMessages(['code' => 'That code is not right. Check the app shows this account and try the newest code.']);
        }

        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()])->save();
        Cache::forget($this->pendingKey($user->id));
        $codes = $twoFactor->replaceRecoveryCodes($user);
        Audit::log('two_factor_enabled', $user, label: $user->email);

        return response()->json(['recovery_codes' => $codes]);
    }

    public function recoveryCodes(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();
        abort_unless($user->hasTwoFactor(), 409, 'Two-step login is off.');

        $codes = $twoFactor->replaceRecoveryCodes($user);
        Audit::log('recovery_codes_replaced', $user, label: $user->email);

        return response()->json(['recovery_codes' => $codes]);
    }

    public function disable(Request $request, TwoFactor $twoFactor): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();

        $twoFactor->disable($user);
        Audit::log('two_factor_disabled', $user, label: $user->email);

        return response()->json(['enabled' => false]);
    }

    private function pendingKey(int $userId): string
    {
        return "two-factor-setup:{$userId}";
    }
}
