<?php

namespace App\Console\Commands;

use App\Enums\RedemptionStatus;
use App\Models\Redemption;
use Illuminate\Console\Command;

/**
 * Clicks whose sale was never confirmed become Expired after a while, so Redemptions shows what
 * is still worth checking. A code handed out from a code list stays used.
 */
class ExpireUnconfirmedClicks extends Command
{
    protected $signature = 'redemptions:expire {--days=30 : Expire clicks older than this many days}';

    protected $description = 'Mark clicks with no confirmed sale after N days as Expired';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));

        $expired = Redemption::where('status', RedemptionStatus::Clicked)
            ->where('clicked_at', '<', now()->subDays($days))
            ->update(['status' => RedemptionStatus::Expired, 'updated_at' => now()]);

        $this->info("{$expired} click(s) older than {$days} days marked Expired.");

        return self::SUCCESS;
    }
}
