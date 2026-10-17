<?php

namespace App\Http\Requests\Admin;

use App\Enums\CategoryType;
use App\Enums\StoreStatus;
use App\Http\Requests\Concerns\NormalizesAdminInput;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveStoreRequest extends FormRequest
{
    use NormalizesAdminInput;

    protected function prepareForValidation(): void
    {
        $this->normalizeSlugAndUrls(['direct_url', 'tracking_url']);
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:160', 'alpha_dash', Rule::unique('stores', 'slug')->ignore($this->route('store'))],
            'category_id' => ['nullable', Rule::exists('categories', 'id')->where('type', CategoryType::Store->value)],
            'heading' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'content' => ['nullable', 'string', 'max:65000'],
            'direct_url' => [$required, 'url:http,https', 'max:2048'],
            'tracking_url' => ['nullable', 'url:http,https', 'max:2048'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'remove_logo' => ['sometimes', 'boolean'],
            'meta_title' => ['nullable', 'string', 'max:190'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'meta_keywords' => ['nullable', 'string', 'max:500'],
            'is_top' => ['sometimes', 'boolean'],
            'is_editor_choice' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::enum(StoreStatus::class)],
            'commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ];
    }
}
