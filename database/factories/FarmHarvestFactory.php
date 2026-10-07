<?php

namespace Database\Factories;

use App\HarvestStatus;
use App\Models\Farm;
use App\Models\FarmHarvest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmHarvest>
 */
class FarmHarvestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'crop_type' => null,
            'production_id' => null,
            'harvest_date' => now()->toDateString(),
            'quantity' => 100,
            'unit' => 'kg',
            'quality_grade' => null,
            'status' => HarvestStatus::Completed,
            'notes' => null,
            'created_by' => User::factory(),
        ];
    }
}
