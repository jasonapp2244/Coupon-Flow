<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Hand-over reset: removes every store, coupon, blog, category, feed, click, rating, log, uploaded
 * image and site setting, and every account except one admin, so a live site starts empty.
 * Run on the server through deploy.sh --reset-content (which backs up the database first).
 */
class ResetContent extends Command
{
    protected $signature = 'content:reset
        {--keep-admin= : Email of the admin account to keep (all other accounts are removed)}
        {--force : Required in production}';

    protected $description = 'Remove all content and activity, keeping only one admin account';

    /** Children before parents, so foreign keys never block a delete. */
    private const TABLES = [
        'redemptions', 'store_ratings', 'sync_runs', 'coupon_codes', 'coupons', 'blogs', 'stores',
        'categories', 'feed_sources', 'activity_logs', 'notifications', 'settings',
        'personal_access_tokens', 'sessions', 'password_reset_tokens',
    ];

    public function handle(): int
    {
        $email = trim((string) $this->option('keep-admin'));
        $admin = $email === '' ? null : User::where('email', $email)->first();

        if (! $admin || ! $admin->isAdmin()) {
            $this->error("--keep-admin must be the email of an existing admin account ({$email} is not).");

            return self::FAILURE;
        }

        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('This deletes all content. Back up the database, then run it again with --force.');

            return self::FAILURE;
        }

        $removed = DB::transaction(function () use ($admin) {
            $counts = [];
            foreach (self::TABLES as $table) {
                if (Schema::hasTable($table)) {
                    $counts[$table] = DB::table($table)->delete();
                }
            }
            $counts['users'] = User::whereKeyNot($admin->getKey())->delete();

            return $counts;
        });

        $disk = Storage::disk('public');
        $files = count($disk->allFiles());
        foreach ($disk->directories() as $dir) {
            $disk->deleteDirectory($dir);
        }
        $disk->delete(array_filter($disk->files(), fn ($file) => $file !== '.gitignore'));

        Cache::flush();

        foreach (array_filter($removed) as $table => $count) {
            $this->line(sprintf('  %-24s %d removed', $table, $count));
        }
        $this->line(sprintf('  %-24s %d removed', 'uploaded files', $files - ($disk->exists('.gitignore') ? 1 : 0)));
        $this->info("Content reset. The only account left is {$admin->email} ({$admin->role->label()}).");

        return self::SUCCESS;
    }
}
