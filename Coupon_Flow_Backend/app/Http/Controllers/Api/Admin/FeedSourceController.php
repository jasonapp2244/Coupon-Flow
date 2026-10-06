<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SyncRunResource;
use App\Models\FeedSource;
use App\Services\FeedImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Brand feeds: each brand or company that sends coupons. Admins add and configure sources;
 * admins and editors run them or upload a CSV; everyone on the staff can see them.
 */
class FeedSourceController extends Controller
{
    public function index(): JsonResponse
    {
        $sources = FeedSource::with('defaultStore')->withCount('coupons')->orderBy('name')->get();

        return response()->json(['data' => $sources->map($this->present(...))]);
    }

    public function store(Request $request): JsonResponse
    {
        $source = FeedSource::create($this->validated($request));

        return response()->json(['data' => $this->present($source->load('defaultStore')->loadCount('coupons'))], Response::HTTP_CREATED);
    }

    public function update(Request $request, FeedSource $feedSource): JsonResponse
    {
        $data = $this->validated($request, $feedSource);
        // Blank key = keep the saved one; the admin only ever sees a mask.
        if (array_key_exists('api_key', $data) && blank($data['api_key']) && ! $request->boolean('remove_api_key')) {
            unset($data['api_key']);
        }
        $feedSource->update($data);

        return response()->json(['data' => $this->present($feedSource->load('defaultStore')->loadCount('coupons'))]);
    }

    /** Imported coupons stay (they just lose the link to the source). */
    public function destroy(FeedSource $feedSource): Response
    {
        $feedSource->delete();

        return response()->noContent();
    }

    public function run(FeedSource $feedSource, FeedImporter $importer): SyncRunResource
    {
        abort_unless($feedSource->isUrlFeed(), 422, 'This source takes CSV uploads. Use "Import CSV" instead.');
        abort_if(blank($feedSource->url), 422, 'Add the feed URL first.');

        return new SyncRunResource($importer->runUrl($feedSource, 'Manual')->load('feedSource'));
    }

    public function import(Request $request, FeedSource $feedSource, FeedImporter $importer): SyncRunResource
    {
        $request->validate(['file' => ['required', 'file', 'max:5120', 'mimes:csv,txt']]);
        $file = $request->file('file');

        return new SyncRunResource($importer->runCsv($feedSource, (string) $file->get(), $file->getClientOriginalName())->load('feedSource'));
    }

    public function template(): StreamedResponse
    {
        return response()->streamDownload(fn () => print (FeedImporter::template()), 'coupon-feed-template.csv', ['Content-Type' => 'text/csv']);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?FeedSource $existing = null): array
    {
        $type = $request->input('type', $existing?->type);

        return $request->validate([
            'name' => [$existing ? 'sometimes' : 'required', 'string', 'max:120'],
            'type' => [$existing ? 'sometimes' : 'required', Rule::in(FeedSource::TYPES)],
            'url' => [Rule::requiredIf($type !== 'csv_upload' && ! $existing?->url), 'nullable', 'url:https', 'max:2048'],
            'api_key' => ['sometimes', 'nullable', 'string', 'max:500'],
            'default_store_id' => ['sometimes', 'nullable', Rule::exists('stores', 'id')->whereNull('deleted_at')],
            'frequency' => ['sometimes', Rule::in(array_keys(FeedSource::FREQUENCIES))],
            'auto_publish' => ['sometimes', 'boolean'],
            'deactivate_missing' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ], ['url.url' => 'The feed URL must start with https://.']);
    }

    /** @return array<string, mixed> */
    private function present(FeedSource $source): array
    {
        $key = (string) $source->api_key;

        return [
            'id' => $source->id,
            'name' => $source->name,
            'type' => $source->type,
            'url' => $source->url,
            'has_api_key' => $key !== '',
            'api_key' => $key !== '' ? '••••'.substr($key, -4) : '',
            'default_store_id' => $source->default_store_id,
            'default_store' => $source->defaultStore?->name,
            'frequency' => $source->frequency,
            'auto_publish' => $source->auto_publish,
            'deactivate_missing' => $source->deactivate_missing,
            'is_active' => $source->is_active,
            'last_run_at' => $source->last_run_at?->toIso8601String(),
            'last_status' => $source->last_status,
            'coupons_count' => $source->coupons_count ?? 0,
        ];
    }
}
