<?php

namespace Database\Seeders;

use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed the development SureFarm administrator.
     */
    public function run(): void
    {
        $admin = User::query()->firstOrNew([
            'email' => 'admin@surefarm.io',
        ]);
        $isNew = ! $admin->exists;

        $attributes = [
            'name' => 'SureFarm Administrator',
            'role' => UserRole::Admin,
            'email_verified_at' => $admin->email_verified_at ?? now(),
        ];

        if ($isNew) {
            $attributes['password'] = Hash::make('password!');
        }

        $admin->forceFill($attributes)->save();

        RegistryGrant::query()->firstOrCreate(
            [
                'user_id' => $admin->id,
                'kind' => RegistryGrantKind::Platform,
                'province' => null,
                'revoked_at' => null,
            ],
            [
                'granted_by' => null,
            ],
        );
    }
}
