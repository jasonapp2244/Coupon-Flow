<?php

namespace App\Console\Commands;

use App\Models\FeedSource;
use App\Services\FeedImporter;
use Illuminate\Console\Command;

/** Runs brand feeds that are due (cron every 15 minutes), or one source on demand. */
class SyncFeeds extends Command
{
    protected $signature = 'feeds:sync {--source= : Run this feed source id now, whether due or not}';

    protected $description = 'Import coupons from brand feeds that are due';

    public function handle(FeedImporter $importer): int
    {
        $sources = $this->option('source')
            ? FeedSource::whereKey($this->option('source'))->get()
            : FeedSource::where('is_active', true)->where('type', '!=', 'csv_upload')->get()->filter->isDue();

        if ($sources->isEmpty()) {
            $this->info('No feeds are due.');

            return self::SUCCESS;
        }

        foreach ($sources as $source) {
            if (! $source->isUrlFeed() || blank($source->url)) {
                $this->warn("Skipped \"{$source->name}\": it has no feed URL.");

                continue;
            }

            $run = $importer->runUrl($source, $this->option('source') ? 'Manual' : 'Scheduled');
            $this->line("{$source->name}: {$run->status->value} (+{$run->coupons_added} new, {$run->coupons_updated} updated, {$run->failed} bad rows) {$run->reference}");
        }

        return self::SUCCESS;
    }
}
