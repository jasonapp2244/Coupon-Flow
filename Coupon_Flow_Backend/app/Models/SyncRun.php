<?php

namespace App\Models;

use App\Enums\SyncStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncRun extends Model
{
    protected $fillable = [
        'feed_source_id', 'reference', 'type', 'started_at', 'completed_at',
        'stores_added', 'coupons_added', 'coupons_updated', 'coupons_kept', 'coupons_deactivated', 'failed', 'errors', 'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => SyncStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'errors' => 'array',
        ];
    }

    public function feedSource(): BelongsTo
    {
        return $this->belongsTo(FeedSource::class);
    }
}
