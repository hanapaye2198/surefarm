<?php

namespace App\Actions;

use App\Models\FarmCrop;

class UpdateFarmCrop
{
    /**
     * Revise crop details without moving the record to another farm.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmCrop $crop, array $data): FarmCrop
    {
        $crop->update([
            'crop_type' => $data['crop_type'],
            'variety' => $data['variety'] ?? null,
            'area_hectares' => $data['area_hectares'] ?? null,
            'planted_on' => $data['planted_on'] ?? null,
            'status' => $data['status'],
            'notes' => $data['notes'] ?? null,
        ]);

        return $crop->load(['farm.farmer']);
    }
}
