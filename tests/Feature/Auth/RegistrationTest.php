<?php

use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\Route;

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
