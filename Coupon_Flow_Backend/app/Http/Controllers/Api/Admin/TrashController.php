<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BlogStatus;
use App\Enums\CouponStatus;
use App\Enums\StoreStatus;
use App\Http\Controllers\Controller;
use App\Models\Blog;
use App\Models\Coupon;
use App\Models\Store;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class TrashController extends Controller
{
    /** @var array<string, class-string<Model>> */
    private const TYPES = [
        'store' => Store::class,
        'coupon' => Coupon::class,
        'blog' => Blog::class,
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate(['type' => ['nullable', Rule::in(array_keys(self::TYPES))]]);

        $items = collect(self::TYPES)
            ->when($request->query('type'), fn (Collection $types, string $type) => $types->only($type))
            ->flatMap(fn (string $class, string $type) => $class::onlyTrashed()->get()->map(fn (Model $m) => [
                'id' => $m->id,
                'type' => $type,
                'name' => $m->name ?? $m->title,
                'original_status' => $m->status->value,
                'deleted_at' => $m->deleted_at->toIso8601String(),
            ]))
            ->sortByDesc('deleted_at')
            ->values();

        return response()->json(['data' => $items]);
    }

    /**
     * Restored items come back unpublished so nothing reappears on the public site unreviewed.
     */
    public function restore(string $type, int $id): JsonResponse
    {
        $model = $this->findTrashed($type, $id);
        $model->restore();
        $model->update(['status' => match ($type) {
            'store' => StoreStatus::Inactive,
            'coupon' => CouponStatus::Draft,
            'blog' => BlogStatus::Draft,
        }]);

        return response()->json(['message' => 'Item restored.']);
    }

    public function destroy(string $type, int $id): JsonResponse
    {
        $this->findTrashed($type, $id)->forceDelete();

        return response()->json(['message' => 'Item permanently deleted.']);
    }

    public function empty(Request $request): JsonResponse
    {
        $request->validate(['type' => ['nullable', Rule::in(array_keys(self::TYPES))]]);

        $purged = 0;

        foreach (self::TYPES as $type => $class) {
            if ($request->filled('type') && $request->input('type') !== $type) {
                continue;
            }

            foreach ($class::onlyTrashed()->get() as $model) {
                $model->forceDelete();
                $purged++;
            }
        }

        return response()->json([
            'message' => "{$purged} item(s) deleted.",
            'purged' => $purged,
        ]);
    }

    private function findTrashed(string $type, int $id): Model
    {
        abort_unless(isset(self::TYPES[$type]), 404);

        return self::TYPES[$type]::onlyTrashed()->findOrFail($id);
    }
}
