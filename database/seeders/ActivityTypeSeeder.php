<?php

namespace Database\Seeders;

use App\ActivityCategory;
use App\ActivityTypeStatus;
use App\Models\ActivityType;
use Illuminate\Database\Seeder;

class ActivityTypeSeeder extends Seeder
{
    /**
     * Seed the activity master list without duplicating existing codes.
     */
    public function run(): void
    {
        $types = [
            ['Land Preparation', 'land_preparation', ActivityCategory::FarmPreparation],
            ['Planting', 'planting', ActivityCategory::FarmPreparation],
            ['Fertilizer Application', 'fertilizer_application', ActivityCategory::CropCare],
            ['Pest Control', 'pest_control', ActivityCategory::Protection],
            ['Weeding', 'weeding', ActivityCategory::CropCare],
            ['Pruning', 'pruning', ActivityCategory::CropCare],
            ['Irrigation', 'irrigation', ActivityCategory::CropCare],
            ['Farm Inspection', 'farm_inspection', ActivityCategory::Inspection],
            ['Harvest Preparation', 'harvest_preparation', ActivityCategory::Harvest],
            ['Harvest', 'harvest', ActivityCategory::Harvest],
            ['Post Harvest', 'post_harvest', ActivityCategory::PostHarvest],
            ['Other', 'other', ActivityCategory::Other],
        ];

        foreach ($types as [$name, $code, $category]) {
            ActivityType::query()->firstOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'category' => $category,
                    'status' => ActivityTypeStatus::Active,
                ],
            );
        }
    }
}
