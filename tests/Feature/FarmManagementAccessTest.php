<?php

use App\Models\User;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected from farm management pages', function (string $routeName) {
    $this->get(route($routeName))->assertRedirect(route('login'));
})->with([
    'farmers' => 'farmers.index',
    'farms' => 'farms.index',
    'farm verification' => 'farm-verification.index',
]);

test('administrators can open farm management pages', function (string $routeName, string $component) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route($routeName))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    'farmers' => ['farmers.index', 'farmers/index'],
    'farms' => ['farms.index', 'farms/index'],
    'farm verification' => ['farm-verification.index', 'farm-verification/index'],
]);

test('operations staff can open farmer and farm pages', function (string $routeName) {
    $user = User::factory()->create([
        'role' => UserRole::Operations,
    ]);

    $this->actingAs($user)
        ->get(route($routeName))
        ->assertOk();
})->with([
    'farmers' => 'farmers.index',
    'farms' => 'farms.index',
]);

test('operations staff cannot open farm verification', function () {
    $user = User::factory()->create([
        'role' => UserRole::Operations,
    ]);

    $this->actingAs($user)
        ->get(route('farm-verification.index'))
        ->assertForbidden();
});

test('field verifiers can open farm verification', function () {
    $user = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($user)
        ->get(route('farm-verification.index'))
        ->assertOk();
});

test('field verifiers can view registered farmers', function () {
    $user = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($user)
        ->get(route('farmers.index'))
        ->assertOk();
});

test('field verifiers can view the farm list', function () {
    $user = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($user)
        ->get(route('farms.index'))
        ->assertOk();
});

test('farmers can open the dashboard', function () {
    $user = User::factory()->create([
        'role' => UserRole::Farmer,
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk();
});

test('farmers cannot open farm management pages', function (string $routeName) {
    $user = User::factory()->create([
        'role' => UserRole::Farmer,
    ]);

    $this->actingAs($user)
        ->get(route($routeName))
        ->assertForbidden();
})->with([
    'farmers' => 'farmers.index',
    'farms' => 'farms.index',
    'farm verification' => 'farm-verification.index',
]);
