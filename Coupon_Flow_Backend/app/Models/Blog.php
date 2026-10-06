<?php

namespace App\Models;

use App\Enums\BlogStatus;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Blog extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'category_id', 'author_id', 'title', 'slug', 'excerpt', 'body', 'featured_image',
        'meta_title', 'meta_description', 'meta_keywords',
        'is_featured', 'status', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => BlogStatus::class,
            'is_featured' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', BlogStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }
}
