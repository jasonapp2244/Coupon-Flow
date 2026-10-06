<?php

namespace Database\Factories;

use App\Enums\StoreStatus;
use App\Models\Store;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Store>
 */
class StoreFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 99999),
            'direct_url' => fake()->url(),
            'tracking_url' => fake()->url(),
            'status' => StoreStatus::Active,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['status' => StoreStatus::Inactive]);
    }
}
