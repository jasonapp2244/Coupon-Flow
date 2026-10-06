<?php

namespace Database\Factories;

use App\Enums\CategoryType;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->word();

        return [
            'type' => CategoryType::Store,
            'name' => ucfirst($name),
            'slug' => Str::slug($name),
            'is_active' => true,
        ];
    }

    public function blog(): static
    {
        return $this->state(fn () => ['type' => CategoryType::Blog]);
    }
}
