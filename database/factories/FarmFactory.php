<?php

namespace Database\Factories;

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\Farmer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Farm>
 */
class FarmFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => 'FARM-'.fake()->unique()->numerify('######'),
            'farmer_id' => Farmer::factory(),
            'farm_name' => fake()->words(2, true),
            'crop_type' => CropType::Coffee,
            'declared_area_hectares' => fake()->randomFloat(2, 0.1, 20),
            'purok_sitio' => null,
            'barangay' => null,
            'municipality' => fake()->city(),
            'province' => fake()->state(),
            'latitude' => null,
            'longitude' => null,
            'verification_status' => FarmVerificationStatus::Pending,
            'status' => FarmStatus::Active,
            'current_stage' => null,
            'number_of_hills' => null,
            'data_validated' => null,
            'property_ownership' => null,
            'contracted_value_estimated' => null,
            'input_support_amount' => null,
            'financing_support_amount' => null,
            'drone_image_path' => null,
            'notes' => null,
        ];
    }
}
