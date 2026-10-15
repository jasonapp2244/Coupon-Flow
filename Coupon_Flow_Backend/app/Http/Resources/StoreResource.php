<?php

namespace App\Http\Resources;

use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin Store */
class StoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
            'category_slug' => $this->whenLoaded('category', fn () => $this->category?->slug),
            'heading' => $this->heading,
            'description' => $this->description,
            'content' => $this->content,
            // Merchant links are admin-only; the public site links out through /api/go.
            'direct_url' => $this->when($this->forAdmin($request), $this->direct_url),
            'tracking_url' => $this->when($this->forAdmin($request), $this->tracking_url),
            'commission_percent' => $this->when($this->forAdmin($request), $this->commission_percent),
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'meta_keywords' => $this->meta_keywords,
            'is_top' => $this->is_top,
            'is_editor_choice' => $this->is_editor_choice,
            'status' => $this->status->value,
            'coupons_count' => $this->whenCounted('coupons'),
            // Visitor star rating: only where the query counted it (the public store page).
            'rating' => $this->whenCounted('ratings', fn (int $count) => [
                'average' => $count ? round((float) $this->ratings_avg_rating, 1) : null,
                'count' => $count,
            ]),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }

    private function forAdmin(Request $request): bool
    {
        return $request->is('api/v1/admin/*');
    }
}
