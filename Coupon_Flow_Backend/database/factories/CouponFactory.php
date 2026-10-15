<?php

namespace Database\Factories;

use App\Enums\CouponStatus;
use App\Enums\CouponType;
use App\Models\Coupon;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Coupon>
 */
class CouponFactory extends Factory
{
    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'title' => fake()->numberBetween(5, 50).'% off '.fake()->words(2, true),
            'type' => CouponType::Code,
            'code' => strtoupper(fake()->unique()->bothify('????##')),
            'expires_at' => now()->addMonth(),
            'status' => CouponStatus::Active,
        ];
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subHour()]);
    }
}
