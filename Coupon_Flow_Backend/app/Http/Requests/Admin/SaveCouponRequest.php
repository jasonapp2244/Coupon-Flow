<?php

namespace App\Http\Requests\Admin;

use App\Enums\CouponStatus;
use App\Enums\CouponType;
use App\Models\Coupon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveCouponRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'store_id' => [$required, Rule::exists('stores', 'id')->whereNull('deleted_at')],
            'title' => [$required, 'string', 'max:200'],
            'type' => [$required, Rule::enum(CouponType::class)],
            'code' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:5000'],
            'tracking_url' => ['nullable', 'url:http,https', 'max:2048'],
            // Date + time in the store's timezone ("2026-10-10T09:00"); a bare date means the whole day.
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', Rule::when($this->filled('starts_at'), 'after:starts_at')],
            // null = unlimited uses.
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:10000000'],
            'status' => ['sometimes', Rule::enum(CouponStatus::class)],
            'is_featured' => ['sometimes', 'boolean'],
            'is_verified' => ['sometimes', 'boolean'],
            'is_exclusive' => ['sometimes', 'boolean'],
            // Code list: each click gets the next code; a visitor may take this many per day (0 = no limit).
            'unique_codes' => ['sometimes', 'boolean'],
            'max_codes_per_visitor' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            // Overrides the store's rate for this coupon; empty = use the store's.
            'commission_percent' => ['nullable', 'numeric', 'min:0', 'max:100', 'decimal:0,2'],
        ];
    }

    /**
     * A "Coupon Code" coupon needs a code, unless it hands out codes from a list. Checked against
     * the resulting coupon, so a partial update cannot leave one without it.
     *
     * @return list<\Closure>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $existing = $this->route('coupon');
            $existing = $existing instanceof Coupon ? $existing : null;

            $type = $this->input('type', $existing?->type->value);
            $code = $this->exists('code') ? $this->input('code') : $existing?->code;
            $list = $this->has('unique_codes') ? $this->boolean('unique_codes') : (bool) $existing?->unique_codes;

            if (blank($code) && ! $list && $type === CouponType::Code->value) {
                $validator->errors()->add('code', 'Enter the coupon code.');
            }
        }];
    }
}
