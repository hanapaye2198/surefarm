<?php

namespace Database\Factories;

use App\CooperativeStatus;
use App\Models\Cooperative;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Cooperative>
 */
class CooperativeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->company(),
            'code' => null,
            'status' => CooperativeStatus::Active,
        ];
    }
}
