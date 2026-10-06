<?php

namespace App\Services;

use App\Enums\CouponStatus;
use App\Enums\CouponType;
use App\Enums\StoreStatus;
use App\Enums\SyncStatus;
use App\Exceptions\FeedRowError;
use App\Models\Coupon;
use App\Models\FeedSource;
use App\Models\Store;
use App\Models\SyncRun;
use App\Notifications\AdminActivity;
use App\Support\Slug;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;
use SplTempFileObject;
use Throwable;

/**
 * Imports a brand's coupons from its feed (JSON or CSV at a URL) or an uploaded CSV, in the
 * "Coupon Follow feed v1" format (see FORMAT below and the admin's Brand Feeds page).
 *
 * Coupons are matched by (source, external_id): new ones are added (as Draft unless the source
 * auto-publishes), changed ones are updated, and ones an admin edited since the last import are
 * left alone. Bad rows are skipped and listed on the sync run.
 */
class FeedImporter
{
    public const MAX_BYTES = 5 * 1024 * 1024;

    public const MAX_ROWS = 5000;

    private const MAX_ERRORS = 200;

    /** Columns of feed format v1, in template order. */
    public const FORMAT = [
        'external_id', 'store', 'store_url', 'title', 'type', 'code', 'description',
        'tracking_url', 'starts_at', 'ends_at', 'usage_limit', 'verified', 'featured',
    ];

    /** Fields the importer owns; if an admin changes any of these, imports stop overwriting the coupon. */
    private const HASHED = ['store_id', 'title', 'type', 'code', 'description', 'tracking_url', 'starts_at', 'expires_at', 'usage_limit', 'is_verified', 'is_featured'];

    /** Fetches the source's feed URL and imports it. */
    public function runUrl(FeedSource $source, string $trigger = 'Scheduled'): SyncRun
    {
        return $this->run($source, "{$trigger} feed sync", function () use ($source) {
            [$body, $contentType] = $this->fetch($source);

            return $source->type === 'json_url' || str_contains($contentType, 'json')
                ? $this->parseJson($body)
                : $this->parseCsv($body);
        }, fullSnapshot: true);
    }

    /** Imports an uploaded CSV file's contents for the source. */
    public function runCsv(FeedSource $source, string $csv, string $fileName): SyncRun
    {
        return $this->run($source, 'CSV import: '.Str::limit($fileName, 60), fn () => $this->parseCsv($csv), fullSnapshot: false);
    }

    /**
     * @param  callable(): list<array<string, mixed>>  $rows
     */
    private function run(FeedSource $source, string $type, callable $rows, bool $fullSnapshot): SyncRun
    {
        $run = SyncRun::create([
            'feed_source_id' => $source->id,
            'reference' => 'SYNC-'.Str::upper(Str::ulid()),
            'type' => $type,
            'started_at' => now(),
            'status' => SyncStatus::Running,
        ]);

        $counts = ['stores_added' => 0, 'coupons_added' => 0, 'coupons_updated' => 0, 'coupons_kept' => 0, 'coupons_deactivated' => 0, 'failed' => 0];
        $errors = [];

        try {
            $data = $rows();
            if (count($data) > self::MAX_ROWS) {
                throw new RuntimeException('The feed has '.count($data).' rows; the limit is '.self::MAX_ROWS.' per run. Split it into smaller files.');
            }

            $seen = Audit::withoutLogging(function () use ($source, $data, &$counts, &$errors) {
                $seen = [];
                foreach ($data as $index => $row) {
                    $rowNumber = $index + 1;
                    try {
                        $seen[] = $this->importRow($source, $row, $counts);
                    } catch (FeedRowError $e) {
                        $counts['failed']++;
                        if (count($errors) < self::MAX_ERRORS) {
                            $errors[] = ['row' => $rowNumber, 'external_id' => (string) ($row['external_id'] ?? ''), 'message' => $e->getMessage()];
                        }
                    }
                }

                return $seen;
            });

            // An empty feed is more likely a broken export than "every coupon ended": never switch all off.
            if ($fullSnapshot && $source->deactivate_missing && $data !== []) {
                $counts['coupons_deactivated'] = Audit::withoutLogging(fn () => $source->coupons()
                    ->where('status', CouponStatus::Active)
                    ->whereNotIn('external_id', array_filter($seen))
                    ->update(['status' => CouponStatus::Inactive]));
            }

            $ok = count($data) - $counts['failed'];
            $status = $counts['failed'] === 0 ? SyncStatus::Completed : ($ok > 0 ? SyncStatus::Partial : SyncStatus::Failed);
        } catch (Throwable $e) {
            report($e);
            $status = SyncStatus::Failed;
            $errors[] = ['row' => null, 'external_id' => null, 'message' => $e instanceof RuntimeException ? $e->getMessage() : 'The import stopped with an unexpected error.'];
        }

        $run->update([...$counts, 'errors' => $errors ?: null, 'status' => $status, 'completed_at' => now()]);
        $source->forceFill(['last_run_at' => now(), 'last_status' => $status->value])->save();

        Audit::log($fullSnapshot ? 'feed_synced' : 'csv_imported', $source, [
            'run' => $run->reference, 'status' => $status->value,
            'added' => $counts['coupons_added'], 'updated' => $counts['coupons_updated'], 'failed' => $counts['failed'],
        ]);

        if ($status !== SyncStatus::Completed) {
            $what = $status === SyncStatus::Failed ? 'failed' : "finished with {$counts['failed']} bad ".Str::plural('row', $counts['failed']);
            AdminActivity::broadcast("Brand feed \"{$source->name}\" {$what} ({$run->reference}).", 'sync_alerts');
        }

        return $run->refresh();
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<string, int>  $counts
     * @return string the row's external_id
     */
    private function importRow(FeedSource $source, array $row, array &$counts): string
    {
        $row = $this->normalise($row);
        $validator = Validator::make($row, [
            'external_id' => ['required', 'string', 'max:190'],
            'store' => [$source->default_store_id ? 'nullable' : 'required', 'string', 'max:190'],
            'store_url' => ['nullable', 'url:http,https', 'max:2048'],
            'title' => ['required', 'string', 'max:200'],
            'type' => ['required', 'in:code,deal'],
            'code' => ['required_if:type,code', 'nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:5000'],
            'tracking_url' => ['nullable', 'url:http,https', 'max:2048'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', ...(filled($row['starts_at'] ?? null) ? ['after:starts_at'] : [])],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:10000000'],
            'verified' => ['nullable', 'boolean'],
            'featured' => ['nullable', 'boolean'],
        ]);
        if ($validator->fails()) {
            throw new FeedRowError($validator->errors()->first());
        }

        $store = $this->resolveStore($source, $row, $counts);

        $values = [
            'store_id' => $store->id,
            'title' => $row['title'],
            'type' => $row['type'] === 'code' ? CouponType::Code : CouponType::Deal,
            'code' => $row['type'] === 'code' ? $row['code'] : null,
            'description' => $row['description'] ?? null,
            'tracking_url' => $row['tracking_url'] ?? null,
            'starts_at' => $row['starts_at'] ?? null,
            'expires_at' => $row['ends_at'] ?? null,
            'usage_limit' => isset($row['usage_limit']) ? (int) $row['usage_limit'] : null,
            'is_verified' => (bool) ($row['verified'] ?? false),
            'is_featured' => (bool) ($row['featured'] ?? false),
        ];

        $coupon = Coupon::withTrashed()->where('feed_source_id', $source->id)->where('external_id', $row['external_id'])->first();

        if ($coupon?->trashed()) {
            // An admin deleted it: importing it again would undo that.
            $counts['coupons_kept']++;

            return $row['external_id'];
        }

        if (! $coupon) {
            $coupon = new Coupon($values);
            $coupon->forceFill([
                'feed_source_id' => $source->id,
                'external_id' => $row['external_id'],
                'status' => $source->auto_publish ? CouponStatus::Active : CouponStatus::Draft,
            ]);
            $coupon->save();
            $coupon->forceFill(['imported_hash' => $this->hash($coupon)])->saveQuietly();
            $counts['coupons_added']++;

            return $row['external_id'];
        }

        if ($coupon->imported_hash && $coupon->imported_hash !== $this->hash($coupon)) {
            $counts['coupons_kept']++; // edited by an admin since the last import

            return $row['external_id'];
        }

        $coupon->fill($values);
        if ($coupon->isDirty()) {
            $coupon->save();
            $counts['coupons_updated']++;
        }
        $coupon->forceFill(['imported_hash' => $this->hash($coupon)])->saveQuietly();

        return $row['external_id'];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<string, int>  $counts
     */
    private function resolveStore(FeedSource $source, array $row, array &$counts): Store
    {
        $name = trim((string) ($row['store'] ?? ''));
        if ($name === '') {
            return $source->defaultStore ?? throw new FeedRowError('The store column is empty and this source has no default store.');
        }

        $store = Store::where('slug', Str::slug($name))->orWhereRaw('lower(name) = ?', [Str::lower($name)])->first();
        if ($store) {
            return $store;
        }

        if (blank($row['store_url'] ?? null)) {
            throw new FeedRowError("Unknown store \"{$name}\". Add it in the admin first, or fill store_url so the import can create it.");
        }

        $counts['stores_added']++;

        // New stores wait as Draft until an admin adds a logo and publishes them.
        return Store::create([
            'name' => Str::limit($name, 120, ''),
            'slug' => Slug::unique(Store::class, $name),
            'direct_url' => $row['store_url'],
            'status' => StoreStatus::Draft,
        ])->refresh();
    }

    /**
     * Lower-case keys, trimmed strings, empty strings as null, type/boolean words normalised.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function normalise(array $row): array
    {
        $clean = [];
        foreach ($row as $key => $value) {
            $key = Str::snake(trim((string) $key));
            $value = is_string($value) ? trim($value) : $value;
            $clean[$key] = $value === '' ? null : $value;
        }
        // "expires_at" is accepted as another name for ends_at.
        $clean['ends_at'] ??= $clean['expires_at'] ?? null;

        if (isset($clean['type'])) {
            $type = Str::lower((string) $clean['type']);
            $clean['type'] = match (true) {
                in_array($type, ['code', 'coupon', 'coupon code', 'coupon_code'], true) => 'code',
                in_array($type, ['deal', 'no code', 'no code required', 'no_code'], true) => 'deal',
                default => $type,
            };
        }
        foreach (['verified', 'featured'] as $flag) {
            if (isset($clean[$flag]) && is_string($clean[$flag])) {
                $clean[$flag] = match (Str::lower($clean[$flag])) {
                    'yes', 'y', 'true', '1' => true,
                    'no', 'n', 'false', '0' => false,
                    default => $clean[$flag],
                };
            }
        }

        return $clean;
    }

    private function hash(Coupon $coupon): string
    {
        $fields = [];
        foreach (self::HASHED as $field) {
            $value = $coupon->getAttribute($field);
            $fields[$field] = $value instanceof \DateTimeInterface ? $value->format('Y-m-d H:i:s') : ($value instanceof \BackedEnum ? $value->value : $value);
        }

        return hash('sha256', json_encode($fields));
    }

    /**
     * @return array{0: string, 1: string} body and content type
     */
    private function fetch(FeedSource $source): array
    {
        $url = (string) $source->url;
        $this->assertSafeUrl($url);

        $response = Http::timeout(20)->connectTimeout(10)
            ->withOptions(['allow_redirects' => false])
            ->withHeaders(['Accept' => 'application/json, text/csv;q=0.9, */*;q=0.5', 'User-Agent' => 'CouponFollow-FeedImporter/1.0'])
            ->when(filled($source->api_key), fn ($http) => $http->withToken($source->api_key))
            ->get($url);

        if (! $response->successful()) {
            throw new RuntimeException("The feed URL answered with HTTP {$response->status()}.");
        }

        $body = $response->body();
        if (strlen($body) > self::MAX_BYTES) {
            throw new RuntimeException('The feed is larger than 5 MB. Ask the brand to split it.');
        }

        return [$body, (string) $response->header('Content-Type')];
    }

    /** https only, and never an address inside our own network (SSRF). */
    private function assertSafeUrl(string $url): void
    {
        $parts = parse_url($url);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            throw new RuntimeException('Feed URLs must start with https://.');
        }

        $host = $parts['host'];
        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if ($ips === []) {
            throw new RuntimeException("The feed host \"{$host}\" could not be found.");
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException('Feed URLs must point to a public internet address.');
            }
        }
    }

    /** @return list<array<string, mixed>> */
    public function parseJson(string $body): array
    {
        $data = json_decode($body, true);
        if (! is_array($data)) {
            throw new RuntimeException('The feed is not valid JSON.');
        }

        $rows = array_is_list($data) ? $data : ($data['coupons'] ?? $data['data'] ?? null);
        if (! is_array($rows) || ! array_is_list($rows)) {
            throw new RuntimeException('The JSON feed must be a list of coupons, or an object with a "coupons" list.');
        }

        return array_values(array_filter($rows, 'is_array'));
    }

    /** @return list<array<string, mixed>> */
    public function parseCsv(string $body): array
    {
        if (strlen($body) > self::MAX_BYTES) {
            throw new RuntimeException('The file is larger than 5 MB. Split it into smaller files.');
        }

        $body = preg_replace('/^\xEF\xBB\xBF/', '', $body); // Excel's UTF-8 marker
        $file = new SplTempFileObject;
        $file->fwrite($body);
        $file->rewind();
        $file->setFlags(SplTempFileObject::READ_CSV | SplTempFileObject::SKIP_EMPTY | SplTempFileObject::READ_AHEAD | SplTempFileObject::DROP_NEW_LINE);

        $header = null;
        $rows = [];
        foreach ($file as $line) {
            if ($line === [null] || $line === false) {
                continue;
            }
            if ($header === null) {
                $header = array_map(fn ($h) => Str::snake(trim((string) $h)), $line);
                if (! in_array('external_id', $header, true) || ! in_array('title', $header, true)) {
                    throw new RuntimeException('The CSV needs a header row with at least external_id, store, title and type. Download the template to start.');
                }

                continue;
            }
            $rows[] = array_combine($header, array_pad(array_slice($line, 0, count($header)), count($header), null));
        }

        return $rows;
    }

    /** The downloadable CSV template: header plus two example rows. */
    public static function template(): string
    {
        $rows = [
            self::FORMAT,
            ['TLTS-10', 'The Loaded Tea Shop', 'https://theloadedteashop.com', 'Sitewide Discount! Get 10% Off', 'code', 'TLTS', 'Get 10% off everything.', '', '2026-10-01 00:00', '2026-10-25 23:59', '500', 'yes', 'no'],
            ['TLTS-SHIP', 'The Loaded Tea Shop', 'https://theloadedteashop.com', 'Free Shipping On Orders Over $20', 'deal', '', 'No code needed.', '', '', '2026-10-25 23:59', '', 'yes', 'no'],
        ];

        $out = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($out, $row);
        }
        rewind($out);

        return (string) stream_get_contents($out);
    }
}
