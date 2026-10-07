<?php

namespace Database\Factories;

use App\ActivityStatus;
use App\Models\ActivityType;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmActivity>
 */
class FarmActivityFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'activity_type_id' => ActivityType::factory(),
            'crop_type' => null,
            'activity_date' => now()->toDateString(),
            'status' => ActivityStatus::Completed,
            'description' => null,
            'performed_by' => null,
            'quantity' => null,
            'unit' => null,
            'cost_amount' => null,
            'remarks' => null,
            'created_by' => User::factory(),
        ];
    }
}
