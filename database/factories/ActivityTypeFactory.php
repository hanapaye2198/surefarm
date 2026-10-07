<?php

namespace Database\Factories;

use App\ActivityCategory;
use App\ActivityTypeStatus;
use App\Models\ActivityType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityType>
 */
class ActivityTypeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'code' => fake()->unique()->slug(2),
            'description' => null,
            'category' => ActivityCategory::CropCare,
            'status' => ActivityTypeStatus::Active,
        ];
    }
}
