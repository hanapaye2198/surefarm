<?php

namespace Database\Factories;

use App\Models\Farm;
use App\Models\FarmProduction;
use App\ProductionStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmProduction>
 */
class FarmProductionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'crop_type' => null,
            'production_period' => (string) now()->year,
            'expected_quantity' => 100,
            'unit' => 'kg',
            'notes' => null,
            'status' => ProductionStatus::Active,
        ];
    }
}
