<?php

namespace Database\Factories;

use App\BankAccountStatus;
use App\Models\Farmer;
use App\Models\FarmerBankAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmerBankAccount>
 */
class FarmerBankAccountFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'farmer_id' => Farmer::factory(),
            'bank_name' => 'LANDBANK',
            'account_number' => fake()->numerify('##########'),
            'account_name' => fake()->name(),
            'status' => BankAccountStatus::Unverified,
        ];
    }
}
