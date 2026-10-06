<?php

namespace App\Models;

use App\Enums\StoreStatus;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Store extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'category_id', 'name', 'slug', 'heading', 'description', 'content',
        'direct_url', 'tracking_url', 'logo_path',
        'meta_title', 'meta_description', 'meta_keywords',
        'is_top', 'is_editor_choice', 'status',
    ];

    protected function casts(): array
    {
        return [
            'status' => StoreStatus::class,
            'is_top' => 'boolean',
            'is_editor_choice' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(StoreRating::class);
    }

    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', StoreStatus::Active);
    }
}
