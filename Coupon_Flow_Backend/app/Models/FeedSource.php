<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A brand or company that sends us coupons: a feed URL we fetch, or CSV files an admin uploads. */
class FeedSource extends Model
{
    use LogsActivity;

    public const TYPES = ['json_url', 'csv_url', 'csv_upload'];

    /** Minutes between automatic runs; manual sources only run when an admin clicks "Run now". */
    public const FREQUENCIES = ['hourly' => 60, 'every_6_hours' => 360, 'daily' => 1440, 'manual' => null];

    protected $fillable = [
        'name', 'type', 'url', 'api_key', 'default_store_id', 'frequency',
        'auto_publish', 'deactivate_missing', 'is_active',
    ];

    protected $hidden = ['api_key'];

    /** Run bookkeeping, not an admin change: each run logs its own summary entry. */
    protected array $auditIgnore = ['last_run_at', 'last_status'];

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'auto_publish' => 'boolean',
            'deactivate_missing' => 'boolean',
            'is_active' => 'boolean',
            'last_run_at' => 'datetime',
        ];
    }

    public function defaultStore(): BelongsTo
    {
        return $this->belongsTo(Store::class, 'default_store_id');
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class);
    }

    public function runs(): HasMany
    {
        return $this->hasMany(SyncRun::class);
    }

    public function isUrlFeed(): bool
    {
        return $this->type !== 'csv_upload';
    }

    /** Due for an automatic run (active URL feed, not manual, interval passed). */
    public function isDue(): bool
    {
        $minutes = self::FREQUENCIES[$this->frequency] ?? null;

        return $this->is_active && $this->isUrlFeed() && $minutes !== null
            && ($this->last_run_at === null || $this->last_run_at->lte(now()->subMinutes($minutes)));
    }
}
