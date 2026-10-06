<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\CategoryType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveCategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\Slug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['type' => ['required', Rule::enum(CategoryType::class)]]);
        $type = CategoryType::from($request->query('type'));

        $query = Category::query()
            ->where('type', $type)
            ->withCount($type === CategoryType::Store ? 'stores' : 'blogs')
            ->when($request->query('q'), fn ($q, $term) => $q->where('name', 'like', "%{$term}%"))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')));

        $this->applySort($query, $request, ['name', 'updated_at', 'created_at'], 'name');

        return CategoryResource::collection($query->paginate($this->perPage($request, 50)));
    }

    public function store(SaveCategoryRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['slug'] = Slug::unique(Category::class, $data['slug'] ?? $data['name'], null, ['type' => $data['type']]);

        return (new CategoryResource(Category::create($data)))
            ->response()->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(SaveCategoryRequest $request, Category $category): CategoryResource
    {
        $data = $request->validated();

        if (! empty($data['slug'])) {
            $data['slug'] = Slug::unique(Category::class, $data['slug'], $category->id, ['type' => $category->type->value]);
        } else {
            unset($data['slug']);
        }

        $category->update($data);

        return new CategoryResource($category);
    }

    /**
     * Stores/blogs in the category are kept; their category_id is nulled by the foreign key.
     */
    public function destroy(Category $category): Response
    {
        $category->delete();

        return response()->noContent();
    }
}
