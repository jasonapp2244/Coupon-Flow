<?php

namespace App\Services;

use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * Two-step login for staff: TOTP codes from an authenticator app (Google Authenticator,
 * Microsoft Authenticator, 1Password…), with one-time recovery codes for a lost phone.
 */
class TwoFactor
{
    /** Codes from one step either side are accepted, for phones whose clock is a little off. */
    private const WINDOW = 1;

    private const RECOVERY_CODES = 10;

    private const CHALLENGE_MINUTES = 5;

    private const CHALLENGE_ATTEMPTS = 5;

    public function __construct(private readonly Google2FA $google2fa = new Google2FA) {}

    public function newSecret(): string
    {
        return $this->google2fa->generateSecretKey(32);
    }

    public function otpauthUrl(User $user, string $secret): string
    {
        return $this->google2fa->getQRCodeUrl(app(SiteSettings::class)->get('general', 'site_name') ?: config('app.name'), $user->email, $secret);
    }

    public function qrSvg(string $otpauthUrl): string
    {
        return (new Writer(new ImageRenderer(new RendererStyle(220, 1), new SvgImageBackEnd)))->writeString($otpauthUrl);
    }

    /** True when $code is the current code for $secret and newer than the last one this user used. */
    public function verify(User $user, string $code, ?string $secret = null): bool
    {
        $secret ??= $user->two_factor_secret;
        $code = preg_replace('/\D/', '', $code);
        if (! $secret || strlen($code) !== 6) {
            return false;
        }

        // 0, not null, for a first code: the library only returns the matched step when given one,
        // and that step must be stored so the same code can't be replayed.
        $step = $this->google2fa->verifyKeyNewer($secret, $code, $user->two_factor_last_step ?? 0, self::WINDOW);
        if (! is_int($step)) {
            return false;
        }

        $user->forceFill(['two_factor_last_step' => $step])->save();

        return true;
    }

    /**
     * New recovery codes: the plain codes go to the user once; only their hashes are kept.
     *
     * @return list<string>
     */
    public function replaceRecoveryCodes(User $user): array
    {
        $codes = array_map(fn () => Str::lower(Str::random(5).'-'.Str::random(5)), range(1, self::RECOVERY_CODES));
        $user->forceFill(['two_factor_recovery_codes' => array_map(self::hashCode(...), $codes)])->save();

        return $codes;
    }

    /** Uses up a recovery code; each works once. */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $hash = self::hashCode(Str::lower(trim($code)));
        $codes = $user->two_factor_recovery_codes ?? [];
        $index = array_search($hash, $codes, true);
        if ($index === false) {
            return false;
        }

        unset($codes[$index]);
        $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

        return true;
    }

    public function remainingRecoveryCodes(User $user): int
    {
        return count($user->two_factor_recovery_codes ?? []);
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_last_step' => null,
        ])->save();
    }

    /** After a correct password: a short-lived ticket for the code step. No token yet. */
    public function startChallenge(User $user, string $device): string
    {
        $id = Str::random(64);
        Cache::put(self::challengeKey($id), ['user_id' => $user->id, 'device' => $device, 'attempts' => 0], now()->addMinutes(self::CHALLENGE_MINUTES));

        return $id;
    }

    /** @return array{user_id: int, device: string, attempts: int}|null */
    public function challenge(string $id): ?array
    {
        return Cache::get(self::challengeKey($id));
    }

    /** Counts a wrong code; the ticket is thrown away after too many. */
    public function failChallenge(string $id): void
    {
        $challenge = $this->challenge($id);
        if (! $challenge) {
            return;
        }

        if (++$challenge['attempts'] >= self::CHALLENGE_ATTEMPTS) {
            $this->endChallenge($id);

            return;
        }

        Cache::put(self::challengeKey($id), $challenge, now()->addMinutes(self::CHALLENGE_MINUTES));
    }

    public function endChallenge(string $id): void
    {
        Cache::forget(self::challengeKey($id));
    }

    private static function challengeKey(string $id): string
    {
        return 'two-factor-challenge:'.hash('sha256', $id);
    }

    /** Recovery codes are long random strings, so a fast hash is enough. */
    private static function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }
}
