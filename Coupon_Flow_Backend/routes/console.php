<?php

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Schedule;

// Run on the server with a cron entry: * * * * * php artisan schedule:run
// Lock expiry in minutes: a killed cron run must not block the job for the default 24 hours.

// Brand feeds: each source runs on its own frequency (hourly / every 6 hours / daily); this only checks which are due.
Schedule::command('feeds:sync')->everyFifteenMinutes()->withoutOverlapping(30);

// Clicks with no confirmed sale after 30 days become Expired.
Schedule::command('redemptions:expire')->dailyAt('03:15')->withoutOverlapping(30);

// Activity log entries older than a year (ActivityLog::KEEP_DAYS).
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->dailyAt('03:30')->withoutOverlapping(30);

// Shared hosting has no supervisor: drain the mail queue from cron instead of a long-running worker.
Schedule::command('queue:work --stop-when-empty --tries=3 --max-time=50')->everyMinute()->withoutOverlapping(5);
