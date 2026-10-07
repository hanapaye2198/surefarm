<?php

namespace Database\Factories;

use App\CropType;
use App\Models\Farm;
use App\Models\TraceabilityLot;
use App\TraceabilityLotStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TraceabilityLot>
 */
class TraceabilityLotFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lot_code' => 'SF-'.now()->year.'-'.str_pad((string) fake()->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
            'farmer_id' => null,
            'farm_id' => Farm::factory(),
            'crop_type' => CropType::Coffee,
            'harvest_id' => null,
            'current_inventory_id' => null,
            'quantity' => 25,
            'unit' => 'kg',
            'status' => TraceabilityLotStatus::Active,
            'notes' => null,
            'created_by' => null,
        ];
    }

    public function configure(): static
    {
        return $this->afterMaking(function (TraceabilityLot $lot): void {
            if ($lot->farmer_id !== null) {
                return;
            }

            $farm = Farm::query()->find($lot->farm_id);

            if ($farm !== null) {
                $lot->farmer_id = $farm->farmer_id;
            }
        });
    }
}
