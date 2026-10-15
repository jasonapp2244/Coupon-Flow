<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RedemptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\RedemptionResource;
use App\Http\Resources\SyncRunResource;
use App\Models\Redemption;
use App\Models\SyncRun;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Activity feeds (redemptions, brand feed sync history, the notification bell) and confirming
 * the sale behind a redemption.
 */
class ActivityController extends Controller
{
    public function redemptions(Request $request): AnonymousResourceCollection
    {
        $query = Redemption::query()
            ->with('store')
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('user_name', 'like', "%{$term}%")
                ->orWhere('coupon_code', 'like', "%{$term}%")
                ->orWhere('reference', 'like', "%{$term}%")))
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('store_id'), fn ($q, $id) => $q->where('store_id', $id));

        $this->applySort($query, $request, ['clicked_at', 'order_value_cents', 'commission_cents'], 'clicked_at');

        return RedemptionResource::collection($query->paginate($this->perPage($request)));
    }

    /** KPI strip for the Redemptions page: counts per status plus money totals. */
    public function redemptionSummary(): JsonResponse
    {
        $byStatus = Redemption::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->map(fn ($n) => (int) $n);

        $sales = $byStatus[RedemptionStatus::Used->value] ?? 0;

        return response()->json([
            'total' => $byStatus->sum(),
            'by_status' => collect(RedemptionStatus::cases())
                ->mapWithKeys(fn (RedemptionStatus $s) => [$s->value => $byStatus[$s->value] ?? 0]),
            'order_value_cents' => (int) Redemption::where('status', RedemptionStatus::Used)->sum('order_value_cents'),
            // The profit: commission on confirmed sales.
            'commission_cents' => (int) Redemption::where('status', RedemptionStatus::Used)->sum('commission_cents'),
            // Confirmed sales out of all clicks.
            'conversion_rate' => $byStatus->sum() ? round($sales / $byStatus->sum() * 100, 1) : 0,
        ]);
    }

    /**
     * Confirms the sale behind a click (from the store's or affiliate network's report): profit is
     * the order amount × the coupon's commission %, else the store's. The rate is copied onto the
     * row so a later rate change doesn't rewrite it. Failed or Pending clear the money.
     */
    public function confirmSale(Request $request, Redemption $redemption): RedemptionResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([RedemptionStatus::Used->value, RedemptionStatus::Failed->value, RedemptionStatus::Pending->value])],
            'order_value' => ['nullable', 'numeric', 'min:0', 'max:1000000', 'decimal:0,2', 'required_if:status,'.RedemptionStatus::Used->value, Rule::when($request->input('status') === RedemptionStatus::Used->value, 'gt:0')],
        ]);

        $before = $redemption->only(['status', 'order_value_cents', 'commission_cents']);
        $used = $data['status'] === RedemptionStatus::Used->value;
        $rate = $used ? ($redemption->coupon?->commissionRate() ?? $redemption->store?->commission_percent ?? 0.0) : null;
        $orderCents = $used ? (int) round($data['order_value'] * 100) : 0;

        $redemption->update([
            'status' => $data['status'],
            'order_value_cents' => $orderCents,
            'commission_percent' => $rate,
            'commission_cents' => $used ? (int) round($orderCents * $rate / 100) : 0,
            'redeemed_at' => $used ? now() : null,
        ]);

        $after = $redemption->only(['status', 'order_value_cents', 'commission_cents']);
        $changes = collect($after)->map(fn ($value, $key) => [$before[$key] instanceof RedemptionStatus ? $before[$key]->value : $before[$key], $value instanceof RedemptionStatus ? $value->value : $value])
            ->filter(fn (array $pair) => $pair[0] !== $pair[1])->all();
        Audit::log('sale_confirmed', $redemption, $changes, label: $redemption->reference);

        return new RedemptionResource($redemption->load('store'));
    }

    public function syncRuns(Request $request): AnonymousResourceCollection
    {
        $runs = SyncRun::query()
            ->with('feedSource')
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('feed_source_id'), fn ($q, $id) => $q->where('feed_source_id', $id))
            ->latest('started_at')
            ->paginate($this->perPage($request));

        return SyncRunResource::collection($runs);
    }

    public function notifications(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'unread' => $user->unreadNotifications()->count(),
            'data' => $user->notifications()->latest()->limit(30)->get()->map(fn ($n) => [
                'id' => $n->id,
                'text' => $n->data['text'] ?? '',
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function markNotificationRead(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->findOrFail($id)->markAsRead();

        return response()->json(['message' => 'Marked as read.']);
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
