<?php

namespace App\Services;

use App\Enums\CouponStatus;
use App\Enums\OrderStatus;
use App\Enums\RedemptionStatus;
use App\Enums\Role;
use App\Enums\SyncStatus;
use App\Models\Coupon;
use App\Models\FeedSource;
use App\Models\Order;
use App\Models\Redemption;
use App\Models\Store;
use App\Models\SyncRun;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardStats
{
    /** @return array<string, int> */
    public function kpis(): array
    {
        $paid = Order::where('status', OrderStatus::Paid);

        return [
            'total_stores' => Store::count(),
            'active_coupons' => Coupon::publiclyVisible()->count(),
            'total_coupons' => Coupon::count(),
            'paid_coupons' => Coupon::where('price_cents', '>', 0)->count(),
            'total_redemptions' => Redemption::where('status', RedemptionStatus::Used)->count(),
            'paid_orders' => (clone $paid)->count(),
            'revenue_cents' => (int) (clone $paid)->sum('total_cents'),
            'customers' => User::where('role', Role::Customer)->count(),
        ];
    }

    /**
     * Paid orders and revenue per day, with empty days filled in so charts have no gaps.
     *
     * @return list<array{date: string, orders: int, revenue_cents: int}>
     */
    public function salesSeries(int $days, ?int $storeId = null): array
    {
        $from = CarbonImmutable::today()->subDays($days - 1);

        $rows = $this->paidOrdersSince($from, $storeId)
            ->selectRaw('DATE(orders.paid_at) as day, COUNT(DISTINCT orders.id) as orders, SUM(order_items.unit_price_cents * order_items.quantity) as revenue')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        return collect(CarbonPeriod::create($from, CarbonImmutable::today()))
            ->map(function ($date) use ($rows) {
                $row = $rows->get($date->toDateString());

                return [
                    'date' => $date->toDateString(),
                    'orders' => (int) ($row->orders ?? 0),
                    'revenue_cents' => (int) ($row->revenue ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    /** @return Collection<int, array{store_id: int, store: string, orders: int, revenue_cents: int}> */
    public function topStores(int $days, int $limit = 5, ?int $storeId = null): Collection
    {
        $rows = $this->paidOrdersSince(CarbonImmutable::today()->subDays($days - 1), $storeId)
            ->selectRaw('coupons.store_id, COUNT(DISTINCT orders.id) as orders, SUM(order_items.unit_price_cents * order_items.quantity) as revenue')
            ->groupBy('coupons.store_id')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get();

        $names = Store::withTrashed()->whereIn('id', $rows->pluck('store_id'))->pluck('name', 'id');

        return $rows->map(fn ($row) => [
            'store_id' => (int) $row->store_id,
            'store' => $names[$row->store_id] ?? 'Deleted store',
            'orders' => (int) $row->orders,
            'revenue_cents' => (int) $row->revenue,
        ]);
    }

    /**
     * Coupon usage headline numbers: uses (click-outs) and coupons by life stage.
     *
     * @return array<string, int>
     */
    public function usageKpis(): array
    {
        $now = now()->utc()->format('Y-m-d H:i:s');
        $in48h = now()->addHours(48)->utc()->format('Y-m-d H:i:s');
        $clicks = fn (CarbonImmutable $from) => Redemption::where('clicked_at', '>=', $from)->count();

        return [
            'uses_today' => $clicks(CarbonImmutable::today()),
            'uses_7d' => $clicks(CarbonImmutable::today()->subDays(6)),
            'uses_30d' => $clicks(CarbonImmutable::today()->subDays(29)),
            'live' => Coupon::live()->count(),
            'scheduled' => Coupon::where('status', CouponStatus::Active)->where('starts_at', '>', $now)->count(),
            'ended' => Coupon::ended()->count(),
            'used_up' => Coupon::whereNotNull('usage_limit')->whereColumn('uses_count', '>=', 'usage_limit')->count(),
            'near_limit' => $this->nearLimit()->count(),
            'ending_48h' => Coupon::live()->whereNotNull('expires_at')->where('expires_at', '<=', $in48h)->count(),
            'feeds_total' => FeedSource::where('is_active', true)->count(),
            'feeds_failing' => FeedSource::where('is_active', true)->whereIn('last_status', [SyncStatus::Failed->value, SyncStatus::Partial->value])->count(),
        ];
    }

    /**
     * Uses (click-outs) per day, empty days filled in.
     *
     * @return list<array{date: string, uses: int}>
     */
    public function usesSeries(int $days, ?int $storeId = null): array
    {
        $from = CarbonImmutable::today()->subDays($days - 1);

        $rows = DB::table('redemptions')
            ->where('clicked_at', '>=', $from)
            ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
            ->selectRaw('DATE(clicked_at) as day, COUNT(*) as uses')
            ->groupBy('day')
            ->pluck('uses', 'day');

        return collect(CarbonPeriod::create($from, CarbonImmutable::today()))
            ->map(fn ($date) => ['date' => $date->toDateString(), 'uses' => (int) ($rows[$date->toDateString()] ?? 0)])
            ->values()
            ->all();
    }

    /**
     * Most-used coupons in the period, with how much of their limit is gone.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function topCoupons(int $days, int $limit = 8, ?int $storeId = null): Collection
    {
        $uses = DB::table('redemptions')
            ->whereNotNull('coupon_id')
            ->where('clicked_at', '>=', CarbonImmutable::today()->subDays($days - 1))
            ->when($storeId, fn ($q) => $q->where('store_id', $storeId))
            ->selectRaw('coupon_id, COUNT(*) as uses')
            ->groupBy('coupon_id')
            ->orderByDesc('uses')
            ->limit($limit)
            ->pluck('uses', 'coupon_id');

        $coupons = Coupon::withTrashed()->with('store')->whereIn('id', $uses->keys())->get()->keyBy('id');

        return $uses->map(fn ($count, $id) => $this->couponRow($coupons[$id] ?? null, (int) $id) + ['uses_in_period' => (int) $count])
            ->values();
    }

    /**
     * The three watch lists on the dashboard.
     *
     * @return array<string, Collection<int, array<string, mixed>>>
     */
    public function watchLists(int $limit = 6): array
    {
        $now = now()->utc()->format('Y-m-d H:i:s');
        $in48h = now()->addHours(48)->utc()->format('Y-m-d H:i:s');

        return [
            'near_limit' => $this->nearLimit()->with('store')
                ->orderByRaw('uses_count * 1.0 / usage_limit desc')->limit($limit)->get()
                ->map(fn (Coupon $c) => $this->couponRow($c, $c->id)),
            'ending_soon' => Coupon::live()->with('store')->whereNotNull('expires_at')->where('expires_at', '<=', $in48h)
                ->orderBy('expires_at')->limit($limit)->get()
                ->map(fn (Coupon $c) => $this->couponRow($c, $c->id)),
            'starting_soon' => Coupon::where('status', CouponStatus::Active)->with('store')
                ->where('starts_at', '>', $now)->where('starts_at', '<=', $in48h)
                ->orderBy('starts_at')->limit($limit)->get()
                ->map(fn (Coupon $c) => $this->couponRow($c, $c->id)),
        ];
    }

    /** @return Collection<int, array<string, mixed>> */
    public function feedHealth(): Collection
    {
        $failures = SyncRun::where('started_at', '>=', now()->subDays(7))
            ->whereIn('status', [SyncStatus::Failed, SyncStatus::Partial])
            ->selectRaw('feed_source_id, COUNT(*) as runs')->groupBy('feed_source_id')->pluck('runs', 'feed_source_id');

        return FeedSource::where('is_active', true)->orderBy('name')->get()->map(fn (FeedSource $s) => [
            'id' => $s->id,
            'name' => $s->name,
            'type' => $s->type,
            'last_run_at' => $s->last_run_at?->toIso8601String(),
            'last_status' => $s->last_status,
            'problem_runs_7d' => (int) ($failures[$s->id] ?? 0),
        ]);
    }

    /** Live coupons with a limit that have used at least 80% of it. */
    private function nearLimit(): EloquentBuilder
    {
        return Coupon::live()->whereNotNull('usage_limit')
            ->whereRaw('uses_count >= usage_limit * ?', [Coupon::NEARLY_USED_UP]);
    }

    /** @return array<string, mixed> */
    private function couponRow(?Coupon $coupon, int $id): array
    {
        return [
            'id' => $id,
            'title' => $coupon?->title ?? 'Deleted coupon',
            'store' => $coupon?->store?->name,
            'state' => $coupon?->trashed() ? 'deleted' : $coupon?->state(),
            'uses_count' => $coupon?->uses_count ?? 0,
            'usage_limit' => $coupon?->usage_limit,
            'used_percent' => $coupon?->usedPercent(),
            'starts_at' => $coupon?->starts_at?->toIso8601String(),
            'expires_at' => $coupon?->expires_at?->toIso8601String(),
        ];
    }

    private function paidOrdersSince(CarbonImmutable $from, ?int $storeId): Builder
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('coupons', 'coupons.id', '=', 'order_items.coupon_id')
            ->where('orders.status', OrderStatus::Paid->value)
            ->where('orders.paid_at', '>=', $from->startOfDay())
            ->when($storeId, fn ($q) => $q->where('coupons.store_id', $storeId));
    }
}
