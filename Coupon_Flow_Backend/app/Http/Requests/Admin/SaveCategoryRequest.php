<?php

namespace App\Http\Requests\Admin;

use App\Enums\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveCategoryRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $type = $this->input('type', $this->route('category')?->type?->value);

        return [
            'type' => [$this->isMethod('post') ? 'required' : 'prohibited', Rule::enum(CategoryType::class)],
            'name' => [$required, 'string', 'max:120'],
            'slug' => [
                'nullable', 'string', 'max:130', 'alpha_dash',
                Rule::unique('categories', 'slug')->where('type', $type)->ignore($this->route('category')),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
