<?php

namespace App\Actions;

use App\CropRecordStatus;
use App\Models\FarmCrop;

class RecordFarmCrop
{
    /**
     * Store crop details for a registered farm. The farm's crop type,
     * area, and verification stay unchanged.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): FarmCrop
    {
        return FarmCrop::query()->create([
            'farm_id' => $data['farm_id'],
            'crop_type' => $data['crop_type'],
            'variety' => $data['variety'] ?? null,
            'area_hectares' => $data['area_hectares'] ?? null,
            'planted_on' => $data['planted_on'] ?? null,
            'status' => $data['status'] ?? CropRecordStatus::Active,
            'notes' => $data['notes'] ?? null,
        ])->load(['farm.farmer']);
    }
}
