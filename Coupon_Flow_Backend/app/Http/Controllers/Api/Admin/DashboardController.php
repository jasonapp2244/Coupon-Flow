<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\RedemptionResource;
use App\Models\ActivityLog;
use App\Models\Redemption;
use App\Services\DashboardStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardStats $stats) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'kpis' => $this->stats->kpis(),
            'usage' => $this->stats->usageKpis(),
            'uses' => $this->stats->usesSeries(30),
            'top_coupons' => $this->stats->topCoupons(30),
            'watch' => $this->stats->watchLists(),
            'feeds' => $this->stats->feedHealth(),
            'recent_redemptions' => RedemptionResource::collection(Redemption::with('store')->latest('clicked_at')->limit(5)->get()),
            // The audit trail is admin-only; others get the notification bell instead.
            'recent_activity' => $user->isAdmin()
                ? ActivityLog::latest('created_at')->orderByDesc('id')->limit(8)->get(['id', 'user_name', 'action', 'subject_type', 'subject_label', 'created_at'])
                : null,
            'two_factor_missing' => ! $user->hasTwoFactor(),
        ]);
    }

    public function analytics(Request $request): JsonResponse
    {
        [$days, $storeId] = $this->filters($request);

        return response()->json([
            'days' => $days,
            'store_id' => $storeId,
            'uses' => $this->stats->usesSeries($days, $storeId),
            'top_coupons' => $this->stats->topCoupons($days, 10, $storeId),
            'profit_by_store' => $this->stats->profitByStore($days, $storeId),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        [$days, $storeId] = $this->filters($request);
        $uses = $this->stats->usesSeries($days, $storeId);
        $sales = $this->stats->salesByDay($days, $storeId);

        return response()->streamDownload(function () use ($uses, $sales): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Coupon uses', 'Sales', 'Profit']);
            foreach ($uses as $row) {
                $day = $sales[$row['date']] ?? ['sales' => 0, 'profit_cents' => 0];
                fputcsv($out, [$row['date'], $row['uses'], $day['sales'], number_format($day['profit_cents'] / 100, 2, '.', '')]);
            }
            fclose($out);
        }, "analytics-{$days}d".($storeId ? "-store-{$storeId}" : '').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** @return array{0: int, 1: int|null} */
    private function filters(Request $request): array
    {
        $data = $request->validate([
            'days' => ['nullable', 'integer', Rule::in([7, 30, 90, 365])],
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
        ]);

        return [(int) ($data['days'] ?? 30), isset($data['store_id']) ? (int) $data['store_id'] : null];
    }
}
