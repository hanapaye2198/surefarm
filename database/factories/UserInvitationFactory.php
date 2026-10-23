<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserInvitation;
use App\UserRole;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<UserInvitation>
 */
class UserInvitationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'name' => fake()->name(),
            'role' => UserRole::Operations,
            'token_hash' => UserInvitation::hashToken(Str::random(64)),
            'expires_at' => now()->addHours(72),
            'invited_by' => User::factory(),
            'accepted_at' => null,
            'revoked_at' => null,
        ];
    }
}
