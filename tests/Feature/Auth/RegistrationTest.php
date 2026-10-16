<?php

use App\Models\User;
use App\UserRole;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));

    $user = User::query()->where('email', 'test@example.com')->first();

    expect($user?->role)->toBe(UserRole::Farmer);

    $user->forceFill(['email_verified_at' => now()])->save();

    $this->actingAs($user)->get(route('farmers.index'))->assertForbidden();
});

test('registration cannot choose an administrator role', function () {
    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'role' => UserRole::Admin->value,
    ]);

    expect(User::query()->where('email', 'test@example.com')->first()?->role)->toBe(UserRole::Farmer);
});
