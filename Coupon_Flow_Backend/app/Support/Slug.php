<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Slug
{
    /**
     * Unique slug for $modelClass, checking trashed rows too so a restore can never collide.
     *
     * @param  class-string<Model>  $modelClass
     * @param  array<string, mixed>  $scope  extra where-clauses the uniqueness is scoped to
     */
    public static function unique(string $modelClass, string $source, ?int $ignoreId = null, array $scope = []): string
    {
        $base = Str::slug($source) ?: 'item';
        $slug = $base;

        for ($i = 2; self::taken($modelClass, $slug, $ignoreId, $scope); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    private static function taken(string $modelClass, string $slug, ?int $ignoreId, array $scope): bool
    {
        $query = in_array(SoftDeletes::class, class_uses_recursive($modelClass), true)
            ? $modelClass::withTrashed()
            : $modelClass::query();

        return $query->where('slug', $slug)
            ->where($scope)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();
    }
}
