<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\CouponCode;
use App\Services\CouponCodePool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** The pool of unique codes behind a paid coupon sold with "Unique code per buyer". */
class CouponCodeController extends Controller
{
    public function index(Request $request, Coupon $coupon): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', 'in:available,sold'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $codes = $coupon->codes()
            ->with('orderItem:id,order_id')
            ->when($request->query('status') === 'available', fn ($q) => $q->whereNull('order_item_id'))
            ->when($request->query('status') === 'sold', fn ($q) => $q->whereNotNull('order_item_id'))
            ->when($request->query('q'), fn ($q, $term) => $q->where('code', 'like', '%'.addcslashes($term, '%_\\').'%'))
            ->orderByRaw('order_item_id is null desc')
            ->orderBy('id')
            ->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($codes->items())->map(fn (CouponCode $code) => [
                'id' => $code->id,
                'code' => $code->code,
                'status' => $code->order_item_id ? 'sold' : 'available',
                'order_id' => $code->orderItem?->order_id,
                'assigned_at' => $code->assigned_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $codes->currentPage(),
                'last_page' => $codes->lastPage(),
                'per_page' => $codes->perPage(),
                'total' => $codes->total(),
                'from' => $codes->firstItem(),
                'to' => $codes->lastItem(),
            ],
        ]);
    }

    public function store(Request $request, Coupon $coupon, CouponCodePool $pool): JsonResponse
    {
        $data = $request->validate([
            'codes' => ['required', 'array', 'min:1', 'max:5000'],
            'codes.*' => ['nullable', 'string', 'max:100'], // blank lines arrive as null and are skipped
        ], [
            'codes.max' => 'Add at most 5,000 codes at a time.',
            'codes.*.max' => 'Codes can be at most 100 characters.',
        ]);

        $result = $pool->add($coupon, $data['codes']);

        return response()->json([...$result, 'stock' => $coupon->fresh()->stock], Response::HTTP_CREATED);
    }

    public function destroy(Coupon $coupon, CouponCode $code, CouponCodePool $pool): JsonResponse
    {
        $pool->remove($coupon, $code);

        return response()->json(['stock' => $coupon->fresh()->stock]);
    }
}
