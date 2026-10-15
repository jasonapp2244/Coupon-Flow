<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\CouponStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCouponRequest;
use App\Http\Resources\CouponResource;
use App\Models\Coupon;
use App\Notifications\AdminActivity;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'state' => ['nullable', Rule::in(['live', 'scheduled', 'ended', 'used_up', 'draft', 'inactive'])],
            'near_limit' => ['nullable', 'boolean'],
        ]);
        $now = now()->utc()->format('Y-m-d H:i:s');

        $query = Coupon::query()
            ->with(['store', 'feedSource'])
            ->when($request->query('feed_source_id'), fn ($q, $id) => $q->where('feed_source_id', $id))
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('title', 'like', "%{$term}%")
                ->orWhere('code', 'like', "%{$term}%")
                ->orWhereHas('codes', fn ($c) => $c->where('code', 'like', "%{$term}%"))))
            ->when($request->query('store_id'), fn ($q, $id) => $q->where('store_id', $id))
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('type'), fn ($q, $type) => $q->where('type', $type))
            ->when($request->has('is_featured'), fn ($q) => $q->where('is_featured', $request->boolean('is_featured')))
            // "Ended Coupons" page: flagged expired, or past the end of the deal window.
            ->when($request->boolean('expired'), fn ($q) => $q->ended())
            ->when($request->query('state'), fn ($q, $state) => match ($state) {
                'draft' => $q->where('status', CouponStatus::Draft),
                'inactive' => $q->where('status', CouponStatus::Inactive),
                'ended' => $q->ended(),
                'scheduled' => $q->whereNotIn('status', [CouponStatus::Draft, CouponStatus::Inactive, CouponStatus::Expired])
                    ->where(fn ($w) => $w->where('status', CouponStatus::Scheduled)->orWhere('starts_at', '>', $now))
                    ->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>=', $now)),
                'used_up' => $q->where('status', CouponStatus::Active)->whereNotNull('usage_limit')->whereColumn('uses_count', '>=', 'usage_limit')
                    ->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>=', $now)),
                'live' => $q->live(),
            })
            // At least 80% of the usage limit used, but not used up yet.
            ->when($request->boolean('near_limit'), fn ($q) => $q->whereNotNull('usage_limit')
                ->whereRaw('uses_count >= usage_limit * ?', [Coupon::NEARLY_USED_UP])
                ->whereColumn('uses_count', '<', 'usage_limit'));

        if ($request->query('sort') === 'used_percent') {
            // Unlimited coupons last, whichever direction.
            $query->orderByRaw('usage_limit is null')
                ->orderByRaw('uses_count * 1.0 / usage_limit '.($request->query('dir') === 'asc' ? 'asc' : 'desc'))
                ->orderBy('id');
        } else {
            $this->applySort($query, $request, ['title', 'expires_at', 'starts_at', 'updated_at', 'created_at', 'uses_count']);
        }

        return CouponResource::collection($query->paginate($this->perPage($request)));
    }

    public function store(SaveCouponRequest $request): JsonResponse
    {
        $coupon = Coupon::create($this->codeDelivery($request->validated(), null))->refresh(); // read back DB defaults (status)
        $coupon->syncCodeCounts();
        AdminActivity::broadcast("New coupon \"{$coupon->title}\" was created");

        return (new CouponResource($coupon->load('store')))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Coupon $coupon): CouponResource
    {
        return new CouponResource($coupon->load('store'));
    }

    public function update(SaveCouponRequest $request, Coupon $coupon): CouponResource
    {
        $coupon->update($this->codeDelivery($request->validated(), $coupon));
        $coupon->refresh()->syncCodeCounts();

        return new CouponResource($coupon->refresh()->load('store'));
    }

    /**
     * A code list has no shared code, and its usage limit is its number of codes (kept in step by
     * syncCodeCounts). Switching a list off makes the coupon unlimited again until a limit is typed.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function codeDelivery(array $data, ?Coupon $coupon): array
    {
        $list = (bool) ($data['unique_codes'] ?? $coupon?->unique_codes);

        if ($list) {
            unset($data['usage_limit']);
            $data['code'] = null;
        } elseif ($coupon?->unique_codes && ! array_key_exists('usage_limit', $data)) {
            $data['usage_limit'] = null;
        }

        return $data;
    }

    public function destroy(Coupon $coupon): Response
    {
        $coupon->delete();

        return response()->noContent();
    }

    public function updateStatus(Request $request, Coupon $coupon): CouponResource
    {
        $data = $request->validate(['status' => ['required', Rule::enum(CouponStatus::class)]]);
        $coupon->update($data);

        return new CouponResource($coupon->load('store'));
    }

    public function duplicate(Coupon $coupon): JsonResponse
    {
        $copy = $coupon->replicate();
        $copy->title = "{$coupon->title} (Copy)";
        $copy->status = CouponStatus::Draft;
        $copy->uses_count = 0;
        if ($copy->unique_codes) {
            $copy->usage_limit = 0; // codes belong to one coupon: the copy starts with an empty list
        }
        $copy->save();

        return (new CouponResource($copy->load('store')))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    /** Starts the usage count again (e.g. the brand topped the coupon up). Past clicks stay in Redemptions. */
    public function resetUses(Coupon $coupon): CouponResource
    {
        // A handed-out code is gone for good: a code list is topped up by adding codes instead.
        abort_if($coupon->unique_codes, 422, 'This coupon uses a code list. Add more codes instead of resetting uses.');

        $before = $coupon->uses_count;
        Coupon::whereKey($coupon->id)->toBase()->update(['uses_count' => 0]);
        Audit::log('uses_reset', $coupon, ['uses_count' => [$before, 0]]);

        return new CouponResource($coupon->refresh()->load('store'));
    }
}
