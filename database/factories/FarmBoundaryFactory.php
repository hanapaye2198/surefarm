<?php

namespace Database\Factories;

use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmBoundary>
 */
class FarmBoundaryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'boundary_geojson' => [
                'type' => 'Polygon',
                'coordinates' => [[
                    [125.1278, 8.1575],
                    [125.1288, 8.1575],
                    [125.1288, 8.1585],
                    [125.1278, 8.1585],
                    [125.1278, 8.1575],
                ]],
            ],
            'gps_measured_area_hectares' => 1.23,
            'created_by' => User::factory(),
            'updated_by' => User::factory(),
            'captured_at' => now(),
        ];
    }
}
