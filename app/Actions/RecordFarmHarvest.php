<?php

namespace App\Actions;

use App\HarvestStatus;
use App\Models\FarmHarvest;
use App\Models\User;

class RecordFarmHarvest
{
    /**
     * Store an actual harvest. The linked production estimate, farm
     * area, verification, activities, and finance records stay as they are.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user): FarmHarvest
    {
        return FarmHarvest::query()->create([
            'farm_id' => $data['farm_id'],
            'crop_type' => $data['crop_type'] ?? null,
            'production_id' => $data['production_id'] ?? null,
            'harvest_date' => $data['harvest_date'],
            'quantity' => $data['quantity'],
            'unit' => $data['unit'],
            'quality_grade' => $data['quality_grade'] ?? null,
            'status' => $data['status'] ?? HarvestStatus::Completed,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ])->load(['farm.farmer', 'production', 'creator']);
    }
}
