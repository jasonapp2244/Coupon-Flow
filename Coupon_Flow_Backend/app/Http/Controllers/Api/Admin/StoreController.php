<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\StoreStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveStoreRequest;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use App\Notifications\AdminActivity;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Store::query()
            ->with('category')
            ->withCount(['coupons', 'ratings'])->withAvg('ratings', 'rating')
            ->when($request->query('q'), fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$term}%")
                ->orWhere('slug', 'like', "%{$term}%")))
            ->when($request->query('category_id'), fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->has('is_top'), fn ($q) => $q->where('is_top', $request->boolean('is_top')))
            ->when($request->has('is_editor_choice'), fn ($q) => $q->where('is_editor_choice', $request->boolean('is_editor_choice')));

        $this->applySort($query, $request, ['name', 'updated_at', 'coupons_count', 'created_at', 'ratings_avg_rating']);

        return StoreResource::collection($query->paginate($this->perPage($request)));
    }

    public function store(SaveStoreRequest $request): JsonResponse
    {
        $data = $request->safe()->except(['logo', 'remove_logo']);
        $data['slug'] = Slug::unique(Store::class, $data['slug'] ?? $data['name']);

        if ($request->hasFile('logo')) {
            $data['logo_path'] = $request->file('logo')->store('stores', 'public');
        }

        $store = Store::create($data)->refresh(); // read back DB defaults (status)
        AdminActivity::broadcast("New store \"{$store->name}\" was created");

        return (new StoreResource($store->load('category')->loadCount(['coupons', 'ratings'])->loadAvg('ratings', 'rating')))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Store $store): StoreResource
    {
        return new StoreResource($store->load('category')->loadCount(['coupons', 'ratings'])->loadAvg('ratings', 'rating'));
    }

    public function update(SaveStoreRequest $request, Store $store): StoreResource
    {
        $data = $request->safe()->except(['logo', 'remove_logo']);

        // Slugs are URLs: only change one when the admin explicitly sends a new slug.
        if (! empty($data['slug'])) {
            $data['slug'] = Slug::unique(Store::class, $data['slug'], $store->id);
        } else {
            unset($data['slug']);
        }

        if ($request->hasFile('logo')) {
            $old = $store->logo_path;
            $data['logo_path'] = $request->file('logo')->store('stores', 'public');
            if ($old) {
                Storage::disk('public')->delete($old);
            }
        } elseif ($request->boolean('remove_logo') && $store->logo_path) {
            Storage::disk('public')->delete($store->logo_path);
            $data['logo_path'] = null;
        }

        $store->update($data);

        return new StoreResource($store->load('category')->loadCount(['coupons', 'ratings'])->loadAvg('ratings', 'rating'));
    }

    public function destroy(Store $store): Response
    {
        $store->delete();

        return response()->noContent();
    }

    public function updateStatus(Request $request, Store $store): StoreResource
    {
        $data = $request->validate(['status' => ['required', Rule::enum(StoreStatus::class)]]);
        $store->update($data);

        return new StoreResource($store->load('category')->loadCount(['coupons', 'ratings'])->loadAvg('ratings', 'rating'));
    }

    public function duplicate(Store $store): JsonResponse
    {
        $copy = $store->replicate(['logo_path']);
        $copy->name = "{$store->name} (Copy)";
        $copy->slug = Slug::unique(Store::class, "{$store->slug}-copy");
        $copy->status = StoreStatus::Draft;
        $copy->save();

        return (new StoreResource($copy->load('category')->loadCount('coupons')))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }
}
