<?php

use App\Models\User;
use App\UserRole;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Support\Facades\Hash;

test('seeds one administrator that can sign in and open farm modules', function () {
    $this->seed(AdminUserSeeder::class);
    $this->seed(AdminUserSeeder::class);

    expect(User::query()->where('email', 'admin@surefarm.io')->count())->toBe(1);

    $admin = User::query()->where('email', 'admin@surefarm.io')->first();

    expect($admin)->not->toBeNull()
        ->and($admin->name)->toBe('SureFarm Administrator')
        ->and($admin->role)->toBe(UserRole::Admin)
        ->and($admin->email_verified_at)->not->toBeNull()
        ->and($admin->password)->not->toBe('password!')
        ->and(Hash::check('password!', $admin->password))->toBeTrue();

    $this->post(route('login.store'), [
        'email' => 'admin@surefarm.io',
        'password' => 'password!',
    ])->assertRedirect(route('dashboard', absolute: false));

    $this->assertAuthenticatedAs($admin);

    $this->get(route('dashboard'))->assertOk();
    $this->get(route('farmers.index'))->assertOk();
    $this->get(route('farms.index'))->assertOk();
    $this->get(route('farm-verification.index'))->assertOk();
});

test('updates an existing account with the admin email instead of creating another', function () {
    User::factory()->create([
        'name' => 'Old Name',
        'email' => 'admin@surefarm.io',
        'role' => UserRole::Farmer,
    ]);

    $this->seed(AdminUserSeeder::class);

    expect(User::query()->where('email', 'admin@surefarm.io')->count())->toBe(1);

    $admin = User::query()->where('email', 'admin@surefarm.io')->first();

    expect($admin->name)->toBe('SureFarm Administrator')
        ->and($admin->role)->toBe(UserRole::Admin)
        ->and(Hash::check('password!', $admin->password))->toBeTrue();
});
