<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\RedemptionStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\RedemptionResource;
use App\Http\Resources\SyncRunResource;
use App\Models\Redemption;
use App\Models\SyncRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only activity feeds: affiliate redemptions, vendor sync history and the notification bell.
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

        return response()->json([
            'total' => $byStatus->sum(),
            'by_status' => collect(RedemptionStatus::cases())
                ->mapWithKeys(fn (RedemptionStatus $s) => [$s->value => $byStatus[$s->value] ?? 0]),
            'order_value_cents' => (int) Redemption::where('status', RedemptionStatus::Used)->sum('order_value_cents'),
            'commission_cents' => (int) Redemption::where('status', RedemptionStatus::Used)->sum('commission_cents'),
        ]);
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
