<?php

namespace Database\Factories;

use App\CropType;
use App\InventoryStatus;
use App\Models\Farm;
use App\Models\Inventory;
use App\Models\InventoryProcessingStage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Inventory>
 */
class InventoryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farmer_id' => null,
            'farm_id' => Farm::factory(),
            'harvest_id' => null,
            'processing_stage_id' => InventoryProcessingStage::factory(),
            'crop_type' => CropType::Coffee,
            'quantity' => 100,
            'unit' => 'kg',
            'status' => InventoryStatus::Available,
            'location' => 'Farm Storage',
            'received_date' => now()->toDateString(),
            'notes' => null,
        ];
    }
}
