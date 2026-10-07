<?php

namespace Database\Factories;

use App\Models\InventoryProcessingStage;
use App\ProcessingStageStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryProcessingStage>
 */
class InventoryProcessingStageFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Coffee Cherry',
            'code' => 'COFFEE_CHERRY',
            'description' => null,
            'sequence' => 1,
            'status' => ProcessingStageStatus::Active,
        ];
    }
}
