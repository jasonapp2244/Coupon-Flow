<?php

namespace App\Http\Controllers\Api;

use App\Enums\CategoryType;
use App\Http\Controllers\Controller;
use App\Http\Resources\BlogResource;
use App\Http\Resources\BlogSummaryResource;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\PublicCouponResource;
use App\Http\Resources\StoreResource;
use App\Models\Blog;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Store;
use App\Models\StoreRating;
use App\Services\ClickOut;
use App\Services\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Read-only catalog for the public website. Only published content is ever returned.
 */
class PublicCatalogController extends Controller
{
    /** Site identity and SEO defaults the admin edits under Settings. Never includes secrets. */
    public function settings(SiteSettings $settings): JsonResponse
    {
        $general = $settings->group('general');

        return response()->json(['data' => [
            'site_name' => $general['site_name'],
            'support_email' => $settings->supportEmail(),
            'currency' => config('services.stripe.currency'),
            'shop_enabled' => $settings->shopEnabled(),
            // Deal windows are shown in the store's time ("Ends Oct 25, 11:59 PM EDT").
            'timezone' => $settings->timezone(),
            ...$settings->group('seo'),
        ]]);
    }

    public function categories(Request $request): AnonymousResourceCollection
    {
        $request->validate(['type' => ['required', Rule::enum(CategoryType::class)]]);

        return CategoryResource::collection(
            Category::where('type', $request->query('type'))->where('is_active', true)
                ->when($request->query('type') === CategoryType::Store->value, fn ($q) => $q->withCount(['stores' => fn ($s) => $s->publiclyVisible()]))
                ->orderBy('name')->get()
        );
    }

    /** A store category page: the category, its stores and its live coupons. */
    public function category(string $slug): JsonResponse
    {
        $category = Category::where('type', CategoryType::Store)->where('is_active', true)->where('slug', $slug)->firstOrFail();

        $stores = Store::publiclyVisible()->where('category_id', $category->id)
            ->with('category')
            ->withCount(['coupons' => fn ($q) => $q->publiclyVisible()])
            ->orderByDesc('is_top')->orderBy('name')->limit(48)->get();

        $coupons = Coupon::publiclyVisible()->with('store')
            ->whereHas('store', fn ($q) => $q->where('category_id', $category->id))
            ->orderByDesc('is_featured')->latest('updated_at')->limit(24)->get();

        return response()->json([
            'data' => new CategoryResource($category),
            'stores' => StoreResource::collection($stores),
            'coupons' => PublicCouponResource::collection($coupons),
        ]);
    }

    public function stores(Request $request): AnonymousResourceCollection
    {
        $term = $this->searchTerm($request);
        $letter = strtoupper((string) $request->query('letter'));

        $query = Store::publiclyVisible()
            ->with('category')
            ->withCount(['coupons' => fn ($q) => $q->publiclyVisible()])
            ->when($term, fn ($q) => $q->where('name', 'like', "%{$term}%"))
            ->when($request->query('category'), fn ($q, $slug) => $q->whereHas('category', fn ($c) => $c->where('slug', $slug)->where('is_active', true)))
            ->when(preg_match('/^[A-Z]$/', $letter), fn ($q) => $q->where('name', 'like', "{$letter}%"))
            ->when($letter === '#', fn ($q) => $q->where(fn ($w) => collect(range(0, 9))->each(fn ($d) => $w->orWhere('name', 'like', "{$d}%"))))
            ->when($request->boolean('top'), fn ($q) => $q->where('is_top', true))
            ->when($request->boolean('editor_choice'), fn ($q) => $q->where('is_editor_choice', true));

        $this->applySort($query, $request, ['name', 'coupons_count', 'updated_at'], 'name');

        return StoreResource::collection($query->paginate($this->perPage($request, 24)));
    }

    public function store(string $slug): JsonResponse
    {
        $store = Store::publiclyVisible()->with('category')->where('slug', $slug)
            ->withCount('ratings')->withAvg('ratings', 'rating')
            ->firstOrFail();

        $coupons = $store->coupons()->publiclyVisible()->with('store')
            ->orderByDesc('is_featured')->latest('updated_at')->get();

        $related = Store::publiclyVisible()->with('category')
            ->withCount(['coupons' => fn ($q) => $q->publiclyVisible()])
            ->whereKeyNot($store->id)
            ->when($store->category_id, fn ($q) => $q->where('category_id', $store->category_id))
            ->orderByDesc('is_top')->orderBy('name')->limit(6)->get();

        return response()->json([
            'data' => new StoreResource($store),
            'coupons' => PublicCouponResource::collection($coupons),
            'related' => StoreResource::collection($related),
        ]);
    }

    /**
     * "Rate this store" from the store page. One vote per visitor (signed-in user, or IP + browser
     * for guests); voting again changes the earlier vote instead of adding one.
     */
    public function rate(Request $request, string $slug): JsonResponse
    {
        $store = Store::publiclyVisible()->where('slug', $slug)->firstOrFail();
        $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5']]);

        $user = auth('sanctum')->user();
        $voter = hash_hmac('sha256', $user ? "user:{$user->id}" : 'guest:'.$request->ip().'|'.$request->userAgent(), config('app.key'));

        // Upsert, so a double click can't trip the unique index.
        StoreRating::upsert(
            [['store_id' => $store->id, 'voter' => $voter, 'user_id' => $user?->id, 'rating' => $data['rating']]],
            ['store_id', 'voter'],
            ['rating'],
        );

        return response()->json([
            'rating' => $data['rating'],
            'average' => round((float) $store->ratings()->avg('rating'), 1),
            'count' => $store->ratings()->count(),
        ]);
    }

    public function coupons(Request $request): AnonymousResourceCollection
    {
        $term = $this->searchTerm($request);

        $query = Coupon::publiclyVisible()
            ->with('store')
            ->when($term, fn ($q) => $q->where(fn ($w) => $w
                ->where('title', 'like', "%{$term}%")
                ->orWhereHas('store', fn ($s) => $s->where('name', 'like', "%{$term}%"))))
            ->when($request->query('store'), fn ($q, $slug) => $q->whereHas('store', fn ($s) => $s->where('slug', $slug)))
            ->when($request->query('category'), fn ($q, $slug) => $q->whereHas('store.category', fn ($c) => $c->where('slug', $slug)))
            ->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true))
            ->when($request->boolean('verified'), fn ($q) => $q->where('is_verified', true))
            ->when($request->has('paid'), fn ($q) => $request->boolean('paid')
                ? $q->where('price_cents', '>', 0)
                : $q->where('price_cents', 0));

        match ($request->query('order')) {
            // Coupons without an end date go last.
            'ending_soon' => $query->orderByRaw('expires_at is null')->orderBy('expires_at')->orderBy('id'),
            'newest' => $query->latest('created_at')->latest('id'),
            'price' => $query->orderBy('price_cents')->orderBy('id'),
            default => $this->applySort($query, $request, ['updated_at', 'expires_at', 'price_cents', 'title']),
        };

        return PublicCouponResource::collection($query->paginate($this->perPage($request, 24)));
    }

    public function coupon(int $id): PublicCouponResource
    {
        return new PublicCouponResource(Coupon::publiclyVisible()->with('store')->findOrFail($id));
    }

    /**
     * Record a click-out and hand back where to send the shopper. Kept for pages still running
     * the previous website bundle; the current site links to /api/go/{id} instead.
     */
    public function click(int $id, ClickOut $clickOut): JsonResponse
    {
        $coupon = Coupon::publiclyVisible()->with('store')->findOrFail($id);
        abort_unless($clickOut->record($coupon, auth('sanctum')->user()), 404, 'This offer is no longer available.');

        return response()->json(['url' => $clickOut->couponUrl($coupon), 'code' => $coupon->isPaid() ? null : $coupon->code]);
    }

    /**
     * What the code pop-up shows once the shopper has clicked out. Free codes only: a paid
     * coupon's code is delivered on its order. The click itself was recorded by /go.
     */
    public function reveal(int $id): JsonResponse
    {
        // Ignores the usage limit: the shopper whose click took the last use must still get the code.
        $coupon = Coupon::publiclyVisible(ignoreUsage: true)->with('store')->findOrFail($id);

        return response()->json(['data' => [
            ...(new PublicCouponResource($coupon))->resolve(),
            'code' => $coupon->isPaid() ? null : $coupon->code,
        ]]);
    }

    /** Header search suggestions: a few stores and coupons. */
    public function search(Request $request): JsonResponse
    {
        $term = $this->searchTerm($request);

        if ($term === null) {
            return response()->json(['stores' => [], 'coupons' => []]);
        }

        $stores = Store::publiclyVisible()->with('category')
            ->withCount(['coupons' => fn ($q) => $q->publiclyVisible()])
            ->where('name', 'like', "%{$term}%")
            ->orderByRaw('name like ? desc', ["{$term}%"])->orderBy('name')->limit(5)->get();

        $coupons = Coupon::publiclyVisible()->with('store')
            ->where(fn ($w) => $w->where('title', 'like', "%{$term}%")
                ->orWhereHas('store', fn ($s) => $s->where('name', 'like', "%{$term}%")))
            ->orderByDesc('is_featured')->latest('updated_at')->limit(5)->get();

        return response()->json([
            'stores' => StoreResource::collection($stores),
            'coupons' => PublicCouponResource::collection($coupons),
        ]);
    }

    /** Everything the sitemap needs, in one small response. */
    public function sitemap(): JsonResponse
    {
        $slugs = fn (Builder $query) => $query->get(['slug', 'updated_at'])
            ->map(fn ($row) => ['slug' => $row->slug, 'updated_at' => $row->updated_at?->toIso8601String()]);

        return response()->json([
            'stores' => $slugs(Store::publiclyVisible()),
            'categories' => $slugs(Category::where('type', CategoryType::Store)->where('is_active', true)),
            'blogs' => $slugs(Blog::publiclyVisible()),
        ]);
    }

    public function blogs(Request $request): AnonymousResourceCollection
    {
        $term = $this->searchTerm($request);

        $query = Blog::publiclyVisible()
            ->with(['category', 'author'])
            ->when($term, fn ($q) => $q->where(fn ($w) => $w->where('title', 'like', "%{$term}%")->orWhere('excerpt', 'like', "%{$term}%")))
            ->when($request->query('category'), fn ($q, $slug) => $q->whereHas('category', fn ($c) => $c->where('slug', $slug)))
            ->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true))
            ->latest('published_at');

        return BlogSummaryResource::collection($query->paginate($this->perPage($request, 12)));
    }

    public function blog(string $slug): BlogResource
    {
        $blog = Blog::publiclyVisible()->with(['category', 'author'])->where('slug', $slug)->firstOrFail();

        // Same topic first, topped up with the newest other posts so the section is never empty.
        $related = Blog::publiclyVisible()->with(['category', 'author'])
            ->whereKeyNot($blog->id)
            ->orderByRaw('category_id = ? desc', [$blog->category_id ?? 0])
            ->latest('published_at')->limit(3)->get();

        return (new BlogResource($blog))->additional(['related' => BlogSummaryResource::collection($related)]);
    }

    /** The ?q= term, trimmed, capped and with LIKE wildcards escaped; null when empty. */
    private function searchTerm(Request $request): ?string
    {
        $term = Str::limit(trim((string) $request->query('q')), 100, '');

        return $term === '' ? null : addcslashes($term, '%_\\');
    }
}
