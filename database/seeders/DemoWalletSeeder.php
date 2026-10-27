<?php

namespace Database\Seeders;

use App\Models\Farmer;
use App\Models\FarmerWalletTransaction;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DemoWalletSeeder extends Seeder
{
    public function run(): void
    {
        $farmer = Farmer::query()->where('farmer_id', 'SF-999-000-000-001')->firstOrFail();

        $samples = [
            [
                'reference' => 'DEMO-WALLET-SALE-001',
                'direction' => 'credit',
                'amount_minor' => 300_000,
                'description' => 'DEMO SAMPLE - Coffee sale credit',
                'days_ago' => 14,
            ],
            [
                'reference' => 'DEMO-WALLET-BILL-001',
                'direction' => 'debit',
                'amount_minor' => 45_000,
                'description' => 'DEMO SAMPLE - Electric bill payment',
                'days_ago' => 7,
            ],
            [
                'reference' => 'DEMO-WALLET-CASHOUT-001',
                'direction' => 'debit',
                'amount_minor' => 25_000,
                'description' => 'DEMO SAMPLE - GCash cash-out',
                'days_ago' => 4,
            ],
            [
                'reference' => 'DEMO-WALLET-HARVEST-001',
                'direction' => 'credit',
                'amount_minor' => 180_000,
                'description' => 'DEMO SAMPLE - Harvest payment credit',
                'days_ago' => 2,
            ],
        ];

        DB::transaction(function () use ($farmer, $samples): void {
            foreach ($samples as $sample) {
                FarmerWalletTransaction::query()->updateOrCreate(
                    ['reference' => $sample['reference']],
                    [
                        'farmer_id' => $farmer->id,
                        'direction' => $sample['direction'],
                        'status' => 'completed',
                        'is_demo' => true,
                        'amount_minor' => $sample['amount_minor'],
                        'currency' => 'PHP',
                        'description' => $sample['description'],
                        'provider' => 'Demo sample',
                        'provider_reference' => $sample['reference'],
                        'occurred_at' => now()->subDays($sample['days_ago']),
                    ],
                );
            }
        });
    }
}
