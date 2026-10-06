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
            // Stripe's minimum charge is 50 cents in USD; 0 means the coupon is free.
            'price_cents' => ['sometimes', 'integer', 'min:0', 'max:99999999', function (string $attr, mixed $value, \Closure $fail) {
                if ($value > 0 && $value < 50) {
                    $fail('A paid coupon must cost at least 0.50.');
                }
            }],
            // Ignored for unique-code coupons: their stock is the number of unsold codes.
            'stock' => ['nullable', 'integer', 'min:0'],
            'unique_codes' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * A code is required for "Coupon Code" coupons and for every paid coupon (the buyer pays for it),
     * unless the paid coupon hands each buyer a code from its pool. Checked against the resulting
     * coupon, so partial updates cannot leave a paid coupon without one.
     *
     * @return list<\Closure>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $existing = $this->route('coupon');
            $existing = $existing instanceof Coupon ? $existing : null;

            $type = $this->input('type', $existing?->type->value);
            $price = (int) $this->input('price_cents', $existing?->price_cents ?? 0);
            $code = $this->exists('code') ? $this->input('code') : $existing?->code;
            $unique = $this->has('unique_codes') ? $this->boolean('unique_codes') : (bool) $existing?->unique_codes;

            if ($unique && $price === 0) {
                $validator->errors()->add('unique_codes', 'Unique codes are for paid coupons only.');

                return;
            }

            if (blank($code) && ! $unique && ($type === CouponType::Code->value || $price > 0)) {
                $validator->errors()->add('code', $price > 0
                    ? 'A paid coupon needs a code: it is what the buyer receives.'
                    : 'Enter the coupon code.');
            }
        }];
    }
}
