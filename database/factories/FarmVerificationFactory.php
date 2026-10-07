<?php

namespace Database\Factories;

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmVerification>
 */
class FarmVerificationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'verification_reference' => 'VER-'.fake()->unique()->numerify('######'),
            'previous_status' => FarmVerificationStatus::Pending,
            'declared_area_hectares' => 2.84,
            'measured_area_hectares' => 2.79,
            'difference_hectares' => 0.05,
            'variance_percentage' => 1.76,
            'result' => null,
            'remarks' => null,
            'verified_by' => null,
            'verified_at' => null,
        ];
    }
}
