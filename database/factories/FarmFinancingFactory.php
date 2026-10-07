<?php

namespace Database\Factories;

use App\FinancingType;
use App\Models\Farm;
use App\Models\FarmFinancing;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmFinancing>
 */
class FarmFinancingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'amount' => 100000,
            'date_granted' => '2026-06-15',
            'loan_balance' => 65000,
            'financing_type' => FinancingType::Govt,
        ];
    }
}
