<?php

namespace App\Models;

use App\Enums\CouponStatus;
use App\Enums\CouponType;
use App\Enums\StoreStatus;
use App\Models\Concerns\LogsActivity;
use App\Services\SiteSettings;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Coupon extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'store_id', 'title', 'type', 'code', 'description', 'tracking_url',
        'starts_at', 'expires_at', 'status',
        'is_featured', 'is_verified', 'is_exclusive', 'usage_limit',
        'unique_codes', 'max_codes_per_visitor', 'commission_percent',
    ];

    /** Clicks are counted with an atomic query, not model saves, so they never reach the activity log. */
    protected array $auditIgnore = ['uses_count', 'imported_hash'];

    /** A coupon at this share of its usage limit triggers one "nearly used up" alert. */
    public const NEARLY_USED_UP = 0.8;

    protected function casts(): array
    {
        return [
            'type' => CouponType::class,
            'status' => CouponStatus::class,
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_featured' => 'boolean',
            'is_verified' => 'boolean',
            'is_exclusive' => 'boolean',
            'usage_limit' => 'integer',
            'uses_count' => 'integer',
            'unique_codes' => 'boolean',
            'max_codes_per_visitor' => 'integer',
            'commission_percent' => 'float',
        ];
    }

    /**
     * A code list keeps usage_limit = all its codes and uses_count = the codes handed out, so the
     * usage-limit rules (hidden when used up, "X left", 80% alert, sort by % used) apply unchanged.
     */
    public function syncCodeCounts(): void
    {
        if (! $this->unique_codes) {
            return;
        }

        $this->forceFill([
            'usage_limit' => $this->codes()->count(),
            'uses_count' => $this->codes()->whereNotNull('redemption_id')->count(),
        ])->saveQuietly();
    }

    /** The rate used for a confirmed sale: this coupon's override, else its store's, else 0. */
    public function commissionRate(): float
    {
        return $this->commission_percent ?? $this->store?->commission_percent ?? 0.0;
    }

    /** Deal start. A bare date means 00:00 that day in the store's timezone. */
    protected function startsAt(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => self::toUtc($value, endOfDay: false));
    }

    /** Deal end. A bare date means 23:59:59 that day in the store's timezone. */
    protected function expiresAt(): Attribute
    {
        return Attribute::make(set: fn (mixed $value) => self::toUtc($value, endOfDay: true));
    }

    /**
     * Stored as UTC. Accepts a Carbon/DateTime, "YYYY-MM-DD" (a whole day), "YYYY-MM-DD HH:mm" or
     * "YYYY-MM-DDTHH:mm" (store-local time, as the admin form and feeds send it), or ISO 8601
     * with an offset (taken as given).
     */
    public static function toUtc(mixed $value, bool $endOfDay): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $timezone = app(SiteSettings::class)->timezone();

        if ($value instanceof DateTimeInterface) {
            $moment = CarbonImmutable::instance($value);
        } elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $value)) {
            $day = CarbonImmutable::parse($value, $timezone);
            $moment = $endOfDay ? $day->endOfDay() : $day->startOfDay();
        } elseif (preg_match('/(Z|[+-]\d{2}:?\d{2})$/i', (string) $value)) {
            $moment = CarbonImmutable::parse($value);
        } else {
            $moment = CarbonImmutable::parse($value, $timezone);
        }

        return $moment->utc()->format('Y-m-d H:i:s');
    }

    /** "YYYY-MM-DDTHH:mm" in the store's timezone, for the admin's date-time inputs. */
    public static function toLocalInput(?CarbonInterface $moment): ?string
    {
        return $moment?->copy()->setTimezone(app(SiteSettings::class)->timezone())->format('Y-m-d\TH:i');
    }

    public function isUsedUp(): bool
    {
        return $this->usage_limit !== null && $this->uses_count >= $this->usage_limit;
    }

    public function usesLeft(): ?int
    {
        return $this->usage_limit === null ? null : max(0, $this->usage_limit - $this->uses_count);
    }

    /** 0-100, one decimal; null when unlimited. */
    public function usedPercent(): ?float
    {
        if (! $this->usage_limit) {
            return null;
        }

        return round(min(100, $this->uses_count / $this->usage_limit * 100), 1);
    }

    /**
     * Where the coupon is in its life, for the admin: draft, inactive, scheduled (window not
     * started), ended (window over or marked expired), used_up (limit reached) or live.
     */
    public function state(): string
    {
        return match (true) {
            $this->status === CouponStatus::Draft => 'draft',
            $this->status === CouponStatus::Inactive => 'inactive',
            $this->status === CouponStatus::Expired, $this->expires_at?->isPast() === true => 'ended',
            $this->status === CouponStatus::Scheduled, $this->starts_at?->isFuture() === true => 'scheduled',
            $this->isUsedUp() => 'used_up',
            default => 'live',
        };
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class)->withTrashed();
    }

    /** The brand feed this coupon was imported from, if any. */
    public function feedSource(): BelongsTo
    {
        return $this->belongsTo(FeedSource::class);
    }

    public function codes(): HasMany
    {
        return $this->hasMany(CouponCode::class);
    }

    /** Click-outs from the public site (and admin-logged redemptions). */
    public function redemptions(): HasMany
    {
        return $this->hasMany(Redemption::class);
    }

    /**
     * Active, inside its deal window right now, and (unless $ignoreUsage) not used up.
     * $ignoreUsage is for the code pop-up: the shopper who just took the last use still sees the code.
     */
    public function scopeLive(Builder $query, bool $ignoreUsage = false): void
    {
        $now = now()->utc()->format('Y-m-d H:i:s');

        $query->where('status', CouponStatus::Active)
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', $now))
            ->when(! $ignoreUsage, fn (Builder $q) => $q->where(fn (Builder $w) => $w->whereNull('usage_limit')->orWhereColumn('uses_count', '<', 'usage_limit')));
    }

    /** Live and attached to an active, non-deleted store. */
    public function scopePubliclyVisible(Builder $query, bool $ignoreUsage = false): void
    {
        $query->live($ignoreUsage)
            ->whereHas('store', fn (Builder $q) => $q->where('status', StoreStatus::Active)->whereNull('deleted_at'));
    }

    /** The deal window is over (or the coupon was marked expired), whatever its status. */
    public function scopeEnded(Builder $query): void
    {
        $query->where(fn (Builder $q) => $q->where('status', CouponStatus::Expired)
            ->orWhere('expires_at', '<', now()->utc()->format('Y-m-d H:i:s')));
    }
}
