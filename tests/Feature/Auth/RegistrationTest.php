<?php

use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Contracts\CreatesNewUsers;

test('public registration is not available', function () {
    expect(Route::has('register'))->toBeFalse()
        ->and(Route::has('register.store'))->toBeFalse();

    $this->get('/register')->assertNotFound();

    $this->post('/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();

    expect(User::query()->where('email', 'test@example.com')->exists())->toBeFalse()
        ->and(User::query()->where('role', UserRole::Admin)->exists())->toBeFalse();
});

test('creating a user ignores a requested administrator role', function () {
    $user = app(CreatesNewUsers::class)->create([
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => UserRole::Admin->value,
    ]);

    expect($user->role)->toBe(UserRole::Farmer)
        ->and(User::query()->where('role', UserRole::Admin)->exists())->toBeFalse();
});
