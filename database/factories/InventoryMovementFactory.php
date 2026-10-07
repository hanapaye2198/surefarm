<?php

namespace Database\Factories;

use App\InventoryMovementType;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryMovement>
 */
class InventoryMovementFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'inventory_id' => Inventory::factory(),
            'destination_inventory_id' => null,
            'source_stage_id' => null,
            'destination_stage_id' => null,
            'quantity' => 100,
            'output_quantity' => null,
            'unit' => 'kg',
            'movement_type' => InventoryMovementType::Receipt,
            'direction' => null,
            'movement_date' => now()->toDateString(),
            'reference_type' => null,
            'reference_id' => null,
            'notes' => null,
            'created_by' => null,
        ];
    }
}
