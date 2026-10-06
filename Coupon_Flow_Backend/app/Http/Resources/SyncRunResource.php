<?php

namespace App\Http\Resources;

use App\Models\SyncRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SyncRun */
class SyncRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'feed_source_id' => $this->feed_source_id,
            'feed_source' => $this->whenLoaded('feedSource', fn () => $this->feedSource?->name),
            'reference' => $this->reference,
            'type' => $this->type,
            'started_at' => $this->started_at->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'stores_added' => $this->stores_added,
            'coupons_added' => $this->coupons_added,
            'coupons_updated' => $this->coupons_updated,
            'coupons_kept' => $this->coupons_kept,
            'coupons_deactivated' => $this->coupons_deactivated,
            'failed' => $this->failed,
            'errors' => $this->errors ?? [],
            'status' => $this->status->value,
        ];
    }
}
