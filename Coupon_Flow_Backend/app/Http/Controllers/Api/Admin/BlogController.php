<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\BlogStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveBlogRequest;
use App\Http\Resources\BlogResource;
use App\Models\Blog;
use App\Notifications\AdminActivity;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class BlogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Blog::query()
            ->with(['category', 'author'])
            ->when($request->query('q'), fn ($q, $term) => $q->where('title', 'like', "%{$term}%"))
            ->when($request->query('category_id'), fn ($q, $id) => $q->where('category_id', $id))
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->has('is_featured'), fn ($q) => $q->where('is_featured', $request->boolean('is_featured')));

        $this->applySort($query, $request, ['title', 'published_at', 'updated_at', 'created_at']);

        return BlogResource::collection($query->paginate($this->perPage($request)));
    }

    public function store(SaveBlogRequest $request): JsonResponse
    {
        $data = $request->safe()->except(['featured_image', 'remove_featured_image']);
        $data['slug'] = Slug::unique(Blog::class, $data['slug'] ?? $data['title']);
        $data['author_id'] = $request->user()->id;
        $data = $this->withPublishDate($data);

        if ($request->hasFile('featured_image')) {
            $data['featured_image'] = $request->file('featured_image')->store('blogs', 'public');
        }

        $blog = Blog::create($data)->refresh(); // read back DB defaults (status)

        if ($blog->status === BlogStatus::Published) {
            AdminActivity::broadcast("Blog \"{$blog->title}\" was published");
        }

        return (new BlogResource($blog->load(['category', 'author'])))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Blog $blog): BlogResource
    {
        return new BlogResource($blog->load(['category', 'author']));
    }

    public function update(SaveBlogRequest $request, Blog $blog): BlogResource
    {
        $data = $request->safe()->except(['featured_image', 'remove_featured_image']);

        if (! empty($data['slug'])) {
            $data['slug'] = Slug::unique(Blog::class, $data['slug'], $blog->id);
        } else {
            unset($data['slug']);
        }

        if ($request->hasFile('featured_image')) {
            $old = $blog->featured_image;
            $data['featured_image'] = $request->file('featured_image')->store('blogs', 'public');
            if ($old) {
                Storage::disk('public')->delete($old);
            }
        } elseif ($request->boolean('remove_featured_image') && $blog->featured_image) {
            Storage::disk('public')->delete($blog->featured_image);
            $data['featured_image'] = null;
        }

        $blog->update($this->withPublishDate($data, $blog));

        return new BlogResource($blog->load(['category', 'author']));
    }

    public function destroy(Blog $blog): Response
    {
        $blog->delete();

        return response()->noContent();
    }

    public function updateStatus(Request $request, Blog $blog): BlogResource
    {
        $data = $request->validate(['status' => ['required', Rule::enum(BlogStatus::class)]]);
        $blog->update($this->withPublishDate($data, $blog));

        return new BlogResource($blog->load(['category', 'author']));
    }

    public function duplicate(Blog $blog): JsonResponse
    {
        $copy = $blog->replicate(['featured_image']);
        $copy->title = "{$blog->title} (Copy)";
        $copy->slug = Slug::unique(Blog::class, "{$blog->slug}-copy");
        $copy->status = BlogStatus::Draft;
        $copy->published_at = null;
        $copy->save();

        return (new BlogResource($copy->load(['category', 'author'])))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Publishing without an explicit date stamps "now", matching the dashboard's behaviour.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withPublishDate(array $data, ?Blog $blog = null): array
    {
        $status = $data['status'] ?? $blog?->status?->value;

        // Published with no date (new, or the admin cleared it) means "publish now".
        $cleared = array_key_exists('published_at', $data) && empty($data['published_at']);

        if ($status === BlogStatus::Published->value && empty($data['published_at']) && ($cleared || ! $blog?->published_at)) {
            $data['published_at'] = now();
        }

        return $data;
    }
}
