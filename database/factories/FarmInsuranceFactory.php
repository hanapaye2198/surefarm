<?php

namespace Database\Factories;

use App\Models\Farm;
use App\Models\FarmInsurance;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmInsurance>
 */
class FarmInsuranceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farm_id' => Farm::factory(),
            'covered' => true,
            'amount' => 50000,
            'term_months' => 12,
        ];
    }

    public function uncovered(): static
    {
        return $this->state(fn (): array => [
            'covered' => false,
            'amount' => null,
            'term_months' => null,
        ]);
    }
}
