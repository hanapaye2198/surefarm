<?php

namespace App\Actions;

use App\Models\FarmHarvest;

class UpdateFarmHarvest
{
    /**
     * Correct a harvest in place. The farm, production link, creator,
     * and original created_at are preserved.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmHarvest $harvest, array $data): FarmHarvest
    {
        $harvest->update([
            'harvest_date' => $data['harvest_date'],
            'quantity' => $data['quantity'],
            'unit' => $data['unit'],
            'quality_grade' => $data['quality_grade'] ?? null,
            'status' => $data['status'],
            'notes' => $data['notes'] ?? null,
        ]);

        return $harvest->load(['farm.farmer', 'production', 'creator']);
    }
}
