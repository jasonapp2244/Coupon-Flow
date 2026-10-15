<?php

namespace App\Services;

use App\Enums\RedemptionStatus;
use App\Models\Coupon;
use App\Models\CouponCode;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\User;
use App\Notifications\AdminActivity;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Where a shopper leaving the site goes, and the click record it leaves behind.
 * Merchant links live only here and in the admin: the public site gets our own /go URLs.
 */
class ClickOut
{
    /** A token from the website: one click, one code. Refreshing reuses it; "Get another code" sends a new one. */
    public const TOKEN_PATTERN = '/^[A-Za-z0-9-]{16,64}$/';

    public function couponUrl(Coupon $coupon): string
    {
        return $coupon->tracking_url ?: $this->storeUrl($coupon->store);
    }

    public function storeUrl(Store $store): string
    {
        return $store->tracking_url ?: $store->direct_url;
    }

    /** Who is clicking, for the per-visitor daily code limit: HMAC of IP + browser, never the raw IP. */
    public function visitorHash(Request $request): string
    {
        return hash_hmac('sha256', 'visitor:'.$request->ip().'|'.$request->userAgent(), (string) config('app.key'));
    }

    /** The token if it is well formed, else null (treated as a click without a token). */
    public function validToken(mixed $token): ?string
    {
        return is_string($token) && preg_match(self::TOKEN_PATTERN, $token) ? $token : null;
    }

    /**
     * Uses one of the coupon's uses, takes the next code of a code list, and records the click.
     * The same token always gets the same click back, so the redirect and the code pop-up can
     * both ask without taking two codes. A null redemption means used up, or (with limit_reached)
     * that this visitor already took today's maximum of codes.
     *
     * @return array{redemption: Redemption|null, limit_reached: bool}
     */
    public function claim(Coupon $coupon, ?string $token, string $visitor, ?User $user = null): array
    {
        $tokenHash = $token ? hash('sha256', $token) : null;

        if ($existing = $this->claimed($coupon, $tokenHash)) {
            return ['redemption' => $existing, 'limit_reached' => false];
        }

        if ($this->overDailyLimit($coupon, $visitor)) {
            return ['redemption' => null, 'limit_reached' => true];
        }

        try {
            $redemption = DB::transaction(fn () => $this->take($coupon, $tokenHash, $visitor, $user));
        } catch (UniqueConstraintViolationException) {
            // The redirect and the pop-up arrived together with the same token: the other one won.
            return ['redemption' => $this->claimed($coupon, $tokenHash), 'limit_reached' => false];
        }

        if ($redemption) {
            $this->alertNearLimit($coupon);
        }

        return ['redemption' => $redemption, 'limit_reached' => false];
    }

    /** The visitor's most recent click on this coupon in the last 24 hours (shown when they hit the limit). */
    public function latestFor(Coupon $coupon, string $visitor): ?Redemption
    {
        return Redemption::where('coupon_id', $coupon->id)->where('visitor_hash', $visitor)
            ->where('clicked_at', '>=', now()->subDay())->latest('clicked_at')->latest('id')->first();
    }

    private function claimed(Coupon $coupon, ?string $tokenHash): ?Redemption
    {
        return $tokenHash ? Redemption::where('coupon_id', $coupon->id)->where('claim_token', $tokenHash)->first() : null;
    }

    private function overDailyLimit(Coupon $coupon, string $visitor): bool
    {
        if (! $coupon->unique_codes || $coupon->max_codes_per_visitor === 0) {
            return false;
        }

        return Redemption::where('coupon_id', $coupon->id)->where('visitor_hash', $visitor)
            ->where('clicked_at', '>=', now()->subDay())->count() >= $coupon->max_codes_per_visitor;
    }

    private function take(Coupon $coupon, ?string $tokenHash, string $visitor, ?User $user): ?Redemption
    {
        // One atomic statement, so two shoppers can never both take the last use.
        $taken = Coupon::whereKey($coupon->id)
            ->where(fn ($q) => $q->whereNull('usage_limit')->orWhereColumn('uses_count', '<', 'usage_limit'))
            ->toBase()
            ->increment('uses_count');

        if ($taken === 0) {
            return null;
        }

        $redemption = Redemption::create([
            'reference' => 'CLK-'.Str::upper(Str::ulid()),
            'user_name' => $user?->name ?? 'Guest',
            'coupon_id' => $coupon->id,
            'coupon_code' => $coupon->code ?: '(deal)',
            'store_id' => $coupon->store_id,
            'clicked_at' => now(),
            'status' => RedemptionStatus::Clicked,
            'claim_token' => $tokenHash,
            'visitor_hash' => $visitor,
        ]);

        if ($coupon->unique_codes) {
            $redemption->update(['coupon_code' => $this->assignCode($coupon, $redemption)]);
        }

        return $redemption;
    }

    /**
     * Hands the oldest free code to the click. The update only succeeds while the code is still
     * free, so two clicks racing for the same code each end up with a different one.
     */
    private function assignCode(Coupon $coupon, Redemption $redemption): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $code = CouponCode::where('coupon_id', $coupon->id)->whereNull('redemption_id')->orderBy('id')->first();

            if (! $code) {
                break;
            }

            $won = CouponCode::whereKey($code->id)->whereNull('redemption_id')
                ->update(['redemption_id' => $redemption->id, 'assigned_at' => now()]);

            if ($won === 1) {
                return $code->code;
            }
        }

        // The counts said a code was free but none was: undo the whole click.
        throw new RuntimeException("Coupon {$coupon->id} has no free code left.");
    }

    /**
     * One alert when a coupon reaches 80% of its limit and one when it is used up. Each count
     * is reached by exactly one increment, so each alert fires once (until uses are reset).
     */
    private function alertNearLimit(Coupon $coupon): void
    {
        if ($coupon->usage_limit === null) {
            return;
        }

        $uses = (int) Coupon::whereKey($coupon->id)->value('uses_count');
        $limit = $coupon->usage_limit;
        $label = "\"{$coupon->title}\"".($coupon->store ? " ({$coupon->store->name})" : '');

        if ($coupon->unique_codes) {
            if ($uses === $limit) {
                AdminActivity::broadcast("Coupon {$label} has no codes left: all {$limit} handed out. It is hidden on the website until you add more codes.", 'redemption_alerts');
            } elseif ($uses === (int) ceil($limit * Coupon::NEARLY_USED_UP) && $uses < $limit) {
                AdminActivity::broadcast("Coupon {$label} is running out of codes: ".($limit - $uses)." of {$limit} left. Add more codes.", 'redemption_alerts');
            }

            return;
        }

        if ($uses === $limit) {
            AdminActivity::broadcast("Coupon {$label} is used up: all {$limit} uses taken. It is hidden on the website.", 'redemption_alerts');
        } elseif ($uses === (int) ceil($limit * Coupon::NEARLY_USED_UP) && $uses < $limit) {
            AdminActivity::broadcast("Coupon {$label} is nearly used up: {$uses} of {$limit} uses taken.", 'redemption_alerts');
        }
    }
}
