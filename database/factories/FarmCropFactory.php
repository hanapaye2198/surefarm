<?php

namespace Database\Factories;

use App\CropRecordStatus;
use App\CropType;
use App\Models\Farm;
use App\Models\FarmCrop;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmCrop>
 */
class FarmCropFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'crop_type' => CropType::Coffee,
            'variety' => null,
            'area_hectares' => null,
            'planted_on' => null,
            'status' => CropRecordStatus::Active,
            'notes' => null,
        ];
    }
}
