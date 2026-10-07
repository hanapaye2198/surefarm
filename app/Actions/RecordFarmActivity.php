<?php

namespace App\Actions;

use App\ActivityStatus;
use App\Models\FarmActivity;
use App\Models\User;

class RecordFarmActivity
{
    /**
     * Store operational history for a farm. Farm area and
     * verification columns are intentionally not updated.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user): FarmActivity
    {
        return FarmActivity::query()->create([
            'farm_id' => $data['farm_id'],
            'activity_type_id' => $data['activity_type_id'],
            'crop_type' => $data['crop_type'] ?? null,
            'activity_date' => $data['activity_date'],
            'status' => $data['status'] ?? ActivityStatus::Completed,
            'description' => $data['description'] ?? null,
            'performed_by' => $data['performed_by'] ?? null,
            'quantity' => $data['quantity'] ?? null,
            'unit' => $data['unit'] ?? null,
            'cost_amount' => $data['cost_amount'] ?? null,
            'remarks' => $data['remarks'] ?? null,
            'created_by' => $user->id,
        ])->load(['farm.farmer', 'activityType', 'creator']);
    }
}
