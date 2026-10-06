<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Category */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'is_active' => $this->is_active,
            // stores_count or blogs_count, depending on which relation the query counted.
            'items_count' => $this->when(
                isset($this->stores_count) || isset($this->blogs_count),
                fn () => $this->stores_count ?? $this->blogs_count,
            ),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
