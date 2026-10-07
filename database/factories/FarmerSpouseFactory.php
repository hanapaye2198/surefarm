<?php

namespace Database\Factories;

use App\Models\Farmer;
use App\Models\FarmerSpouse;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmerSpouse>
 */
class FarmerSpouseFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farmer_id' => Farmer::factory(),
            'first_name' => fake()->firstName(),
            'middle_name' => null,
            'last_name' => fake()->lastName(),
        ];
    }
}
