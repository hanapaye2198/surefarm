<?php

namespace Database\Seeders;

use App\Models\InventoryProcessingStage;
use App\ProcessingStageStatus;
use Illuminate\Database\Seeder;

class InventoryProcessingStageSeeder extends Seeder
{
    /**
     * Seed coffee processing stages without duplicating existing codes.
     */
    public function run(): void
    {
        $stages = [
            ['Coffee Cherry', 'COFFEE_CHERRY', 'Fresh coffee cherry received from harvest.', 1],
            ['Parchment', 'PARCHMENT', 'Coffee cherry processed to parchment.', 2],
            ['Dried Coffee', 'DRIED_COFFEE', 'Parchment dried before milling.', 3],
            ['Green Beans', 'GREEN_BEANS', 'Dried coffee milled to green beans.', 4],
        ];

        foreach ($stages as [$name, $code, $description, $sequence]) {
            $stage = InventoryProcessingStage::query()->firstOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'description' => $description,
                    'sequence' => $sequence,
                    'status' => ProcessingStageStatus::Active,
                ],
            );

            $stage->fill([
                'name' => $name,
                'description' => $description,
                'sequence' => $sequence,
            ])->save();
        }
    }
}
