<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\StoreRating;
use App\Notifications\AdminActivity;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Visitor star ratings of a store: see them, remove a bad vote, or reset the store's rating. */
class StoreRatingController extends Controller
{
    /** Average, vote count and how many votes each star level got. */
    public function summary(Store $store): JsonResponse
    {
        return response()->json($this->summaryOf($store));
    }

    public function index(Request $request, Store $store): JsonResponse
    {
        $request->validate(['rating' => ['nullable', 'integer', 'between:1,5']]);

        $votes = $store->ratings()
            ->with('user:id,name,email')
            ->when($request->query('rating'), fn ($q, $rating) => $q->where('rating', $rating))
            ->latest('updated_at')->orderByDesc('id')
            ->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($votes->items())->map(fn (StoreRating $vote) => [
                'id' => $vote->id,
                'rating' => $vote->rating,
                'voter' => $vote->user ? ['name' => $vote->user->name, 'email' => $vote->user->email] : null,
                'created_at' => $vote->created_at?->toIso8601String(),
                'updated_at' => $vote->updated_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $votes->currentPage(),
                'last_page' => $votes->lastPage(),
                'per_page' => $votes->perPage(),
                'total' => $votes->total(),
                'from' => $votes->firstItem(),
                'to' => $votes->lastItem(),
            ],
        ]);
    }

    /** Removes one vote (e.g. spam). Returns the new summary. */
    public function destroy(Store $store, StoreRating $rating): JsonResponse
    {
        $rating->delete();
        Audit::log('rating_removed', $store, ['rating' => $rating->rating]);

        return response()->json($this->summaryOf($store));
    }

    /** Deletes every vote for the store, so its rating starts again from zero. */
    public function reset(Store $store): JsonResponse
    {
        $removed = $store->ratings()->delete();
        Audit::log('ratings_reset', $store, ['votes_removed' => $removed]);
        AdminActivity::broadcast("Rating of store \"{$store->name}\" was reset ({$removed} ".str('vote')->plural($removed).' removed)');

        return response()->json($this->summaryOf($store) + ['removed' => $removed]);
    }

    /** @return array{average: float|null, count: int, breakdown: array<int, int>} */
    private function summaryOf(Store $store): array
    {
        $counts = $store->ratings()->selectRaw('rating, count(*) as votes')->groupBy('rating')->pluck('votes', 'rating');
        $count = (int) $counts->sum();
        $breakdown = collect(range(5, 1))->mapWithKeys(fn (int $star) => [$star => (int) ($counts[$star] ?? 0)]);

        return [
            'average' => $count ? round($breakdown->map(fn ($n, $star) => $n * $star)->sum() / $count, 1) : null,
            'count' => $count,
            'breakdown' => $breakdown->all(),
        ];
    }
}
