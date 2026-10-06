<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use Prunable;

    /** Entries are kept for a year (`model:prune` runs daily). */
    public const KEEP_DAYS = 365;

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'user_name', 'action', 'subject_type', 'subject_id', 'subject_label', 'changes', 'ip', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['changes' => 'array', 'created_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function prunable(): Builder
    {
        return static::where('created_at', '<', now()->subDays(self::KEEP_DAYS));
    }
}
