<?php

namespace App\Http\Requests\Admin;

use App\Enums\BlogStatus;
use App\Enums\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveBlogRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:210', 'alpha_dash', Rule::unique('blogs', 'slug')->ignore($this->route('blog'))],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('type', CategoryType::Blog->value)],
            'excerpt' => ['nullable', 'string', 'max:2000'],
            'body' => ['nullable', 'string', 'max:200000'],
            'featured_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:5120'],
            'remove_featured_image' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:190'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'meta_keywords' => ['nullable', 'string', 'max:500'],
            'is_featured' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::enum(BlogStatus::class)],
            'published_at' => ['nullable', 'date'],
        ];
    }
}
