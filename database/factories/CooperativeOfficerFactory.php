<?php

namespace Database\Factories;

use App\Models\Cooperative;
use App\Models\CooperativeOfficer;
use App\Models\User;
use App\UserRole;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CooperativeOfficer>
 */
class CooperativeOfficerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => UserRole::CooperativeOfficer]),
            'cooperative_id' => Cooperative::factory(),
            'assigned_by' => User::factory(),
            'assigned_at' => now(),
            'revoked_at' => null,
        ];
    }
}
