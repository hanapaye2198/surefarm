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
            ['Dried Coffee', 'DRIED_COFFEE', 'Coffee dried after the cherry stage.', 2],
            ['Parchment', 'PARCHMENT', 'Dried coffee hulled to parchment.', 3],
            ['Green Beans', 'GREEN_BEANS', 'Parchment milled to green coffee beans.', 4],
        ];

        foreach ($stages as [$name, $code, $description, $sequence]) {
            InventoryProcessingStage::query()->firstOrCreate(
                ['code' => $code],
                [
                    'name' => $name,
                    'description' => $description,
                    'sequence' => $sequence,
                    'status' => ProcessingStageStatus::Active,
                ],
            );
        }
    }
}
