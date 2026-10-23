<?php

namespace Database\Factories;

use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RegistryGrant>
 */
class RegistryGrantFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'kind' => RegistryGrantKind::Province,
            'province' => 'Bukidnon',
            'granted_by' => null,
            'revoked_at' => null,
        ];
    }
}
