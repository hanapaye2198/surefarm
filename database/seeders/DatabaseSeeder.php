<?php

namespace Database\Seeders;

use App\Models\User;
use App\UserRole;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(AdminUserSeeder::class);
        $this->call(ActivityTypeSeeder::class);
        $this->call(InventoryProcessingStageSeeder::class);

        $tester = User::query()->firstOrNew([
            'email' => 'test@example.com',
        ]);

        if (! $tester->exists) {
            $tester->forceFill([
                'name' => 'Test User',
                'role' => UserRole::Admin,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ])->save();
        }
    }
}
