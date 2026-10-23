<?php

namespace Database\Factories;

use App\Models\Farm;
use App\Models\FarmVerifierAssignment;
use App\Models\User;
use App\UserRole;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FarmVerifierAssignment>
 */
class FarmVerifierAssignmentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->state(['role' => UserRole::FieldVerifier]),
            'farm_id' => Farm::factory(),
            'assigned_by' => null,
            'assigned_at' => now(),
            'revoked_at' => null,
        ];
    }
}
