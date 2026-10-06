<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Coupons get an exact deal window (date + time, stored in UTC) and an optional usage limit.
     * Existing day-only windows keep their meaning in the store's timezone: they start at
     * 00:00:00 and end at 23:59:59 local time.
     */
    public function up(): void
    {
        $timezone = $this->storeTimezone();
        $windows = DB::table('coupons')->whereNotNull('starts_at')->orWhereNotNull('expires_at')->get(['id', 'starts_at', 'expires_at']);

        Schema::table('coupons', function (Blueprint $table) {
            $table->dateTime('starts_at')->nullable()->change();
            $table->dateTime('expires_at')->nullable()->change();
            // null = unlimited. Each "Show coupon code" / "Get deal" click uses one.
            $table->unsignedInteger('usage_limit')->nullable()->after('stock');
            $table->unsignedInteger('uses_count')->default(0)->after('usage_limit');
        });

        foreach ($windows as $row) {
            DB::table('coupons')->where('id', $row->id)->update([
                'starts_at' => $row->starts_at ? $this->utc(substr($row->starts_at, 0, 10), $timezone, endOfDay: false) : null,
                'expires_at' => $row->expires_at ? $this->utc(substr($row->expires_at, 0, 10), $timezone, endOfDay: true) : null,
            ]);
        }

        // Clicks so far count as uses.
        $counts = DB::table('redemptions')->whereNotNull('coupon_id')->selectRaw('coupon_id, count(*) as uses')->groupBy('coupon_id')->pluck('uses', 'coupon_id');
        foreach ($counts as $couponId => $uses) {
            DB::table('coupons')->where('id', $couponId)->update(['uses_count' => $uses]);
        }
    }

    public function down(): void
    {
        $timezone = $this->storeTimezone();
        $windows = DB::table('coupons')->whereNotNull('starts_at')->orWhereNotNull('expires_at')->get(['id', 'starts_at', 'expires_at']);

        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn(['usage_limit', 'uses_count']);
        });

        foreach ($windows as $row) {
            DB::table('coupons')->where('id', $row->id)->update([
                'starts_at' => $row->starts_at ? CarbonImmutable::parse($row->starts_at, 'UTC')->setTimezone($timezone)->toDateString() : null,
                'expires_at' => $row->expires_at ? CarbonImmutable::parse($row->expires_at, 'UTC')->setTimezone($timezone)->toDateString() : null,
            ]);
        }

        Schema::table('coupons', function (Blueprint $table) {
            $table->date('starts_at')->nullable()->change();
            $table->date('expires_at')->nullable()->change();
        });
    }

    private function utc(string $date, string $timezone, bool $endOfDay): string
    {
        $local = CarbonImmutable::parse($date, $timezone);

        return ($endOfDay ? $local->endOfDay() : $local->startOfDay())->utc()->format('Y-m-d H:i:s');
    }

    /** The admin-set timezone (Settings → General), read directly: models may change after this migration. */
    private function storeTimezone(): string
    {
        $general = json_decode((string) DB::table('settings')->where('key', 'general')->value('value'), true) ?: [];
        $timezone = $general['timezone'] ?? 'America/New_York';

        return in_array($timezone, timezone_identifiers_list(), true) ? $timezone : 'America/New_York';
    }
};
