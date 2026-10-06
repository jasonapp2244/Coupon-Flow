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
            'price_cents' => 0,
            'stock' => null,
        ];
    }

    public function paid(int $cents = 499, ?int $stock = null): static
    {
        return $this->state(fn () => ['price_cents' => $cents, 'stock' => $stock]);
    }

    /** Paid coupon handing each buyer their own code; `$codes` go into its pool and become its stock. */
    public function uniqueCodes(array $codes = [], int $cents = 499): static
    {
        return $this->state(fn () => ['price_cents' => $cents, 'code' => null, 'unique_codes' => true, 'stock' => count($codes)])
            ->afterCreating(function (Coupon $coupon) use ($codes) {
                foreach ($codes as $code) {
                    $coupon->codes()->create(['code' => $code]);
                }
            });
    }

    public function expired(): static
    {
        return $this->state(fn () => ['expires_at' => now()->subHour()]);
    }
}
