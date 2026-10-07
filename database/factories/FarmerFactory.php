<?php

namespace Database\Factories;

use App\FarmerStatus;
use App\Models\Farmer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Farmer>
 */
class FarmerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farmer_id' => 'SF-'.fake()->unique()->numerify('###-###-###-###'),
            'first_name' => fake()->firstName(),
            'middle_name' => null,
            'last_name' => fake()->lastName(),
            'date_of_birth' => null,
            'government_id' => null,
            'photo_path' => null,
            'purok_sitio' => fake()->streetName(),
            'barangay' => fake()->city(),
            'municipality' => fake()->city(),
            'province' => fake()->state(),
            'mobile_number' => fake()->numerify('09#########'),
            'email' => null,
            'cooperative_id' => null,
            'status' => FarmerStatus::Active,
        ];
    }
}
