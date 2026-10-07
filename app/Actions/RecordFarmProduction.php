<?php

namespace App\Actions;

use App\Models\FarmProduction;
use App\ProductionStatus;

class RecordFarmProduction
{
    /**
     * Store an expected production estimate. Farm area, verification,
     * activities, and finance records are left unchanged.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): FarmProduction
    {
        return FarmProduction::query()->create([
            'farm_id' => $data['farm_id'],
            'crop_type' => $data['crop_type'] ?? null,
            'production_period' => $data['production_period'] ?? null,
            'expected_quantity' => $data['expected_quantity'] ?? null,
            'unit' => $data['unit'],
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? ProductionStatus::Active,
        ])->load(['farm.farmer']);
    }
}
