<?php

namespace App\Actions;

use App\Models\FarmProduction;

class UpdateFarmProduction
{
    /**
     * Revise the estimate without moving it to another farm and
     * without changing harvest rows already recorded against it.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmProduction $production, array $data): FarmProduction
    {
        $production->update([
            'crop_type' => $data['crop_type'] ?? null,
            'production_period' => $data['production_period'] ?? null,
            'expected_quantity' => $data['expected_quantity'] ?? null,
            'unit' => $data['unit'],
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'],
        ]);

        return $production->load(['farm.farmer']);
    }
}
