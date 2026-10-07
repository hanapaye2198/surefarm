<?php

namespace App\Actions;

use App\Models\FarmActivity;

class UpdateFarmActivity
{
    /**
     * Revise an activity without moving it to another farm and
     * without changing that farm's area or verification.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmActivity $activity, array $data): FarmActivity
    {
        $activity->update([
            'activity_type_id' => $data['activity_type_id'],
            'crop_type' => $data['crop_type'] ?? null,
            'activity_date' => $data['activity_date'],
            'status' => $data['status'],
            'description' => $data['description'] ?? null,
            'performed_by' => $data['performed_by'] ?? null,
            'quantity' => $data['quantity'] ?? null,
            'unit' => $data['unit'] ?? null,
            'cost_amount' => $data['cost_amount'] ?? null,
            'remarks' => $data['remarks'] ?? null,
        ]);

        return $activity->load(['farm.farmer', 'activityType', 'creator']);
    }
}
