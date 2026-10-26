<?php

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\User;
use App\Notifications\FarmVerificationStatusNotification;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

test('the website verification list ignores the mobile assignment queue', function () {
    Farm::factory()->create([
        'farm_name' => 'Pending Plot',
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    Farm::factory()->create([
        'farm_name' => 'Finished Plot',
        'verification_status' => FarmVerificationStatus::Verified,
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('farm-verification.index', ['queue' => 'assignments']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farm-verification/index')
            ->has('farms.data', 2));
});

test('the mobile assignment queue lists only open assigned visits', function () {
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $pending = Farm::factory()->create([
        'farm_name' => 'Pending Plot',
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    $finished = Farm::factory()->create([
        'farm_name' => 'Finished Plot',
        'verification_status' => FarmVerificationStatus::Verified,
    ]);
    $hidden = Farm::factory()->create([
        'farm_name' => 'Hidden Plot',
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    assignFarmVerifier($verifier, $pending);
    assignFarmVerifier($verifier, $finished);

    Sanctum::actingAs($verifier, ['mobile']);

    $assignments = $this->getJson('/api/mobile/farm-verification?queue=assignments')
        ->assertOk()
        ->assertJsonPath('component', 'farm-verification/index');

    expect(collect($assignments->json('data.farms.data'))->pluck('farm_name')->all())
        ->toBe(['Pending Plot']);

    $history = $this->getJson('/api/mobile/farm-verification?queue=history')->assertOk();

    expect(collect($history->json('data.farms.data'))->pluck('farm_name')->all())
        ->toBe(['Finished Plot']);

    $unfiltered = $this->getJson('/api/mobile/farm-verification?queue=assignments OR 1=1')->assertOk();

    expect(collect($unfiltered->json('data.farms.data'))->pluck('farm_name')->all())
        ->toContain('Pending Plot')
        ->toContain('Finished Plot')
        ->not->toContain('Hidden Plot');
});

test('a farmer mobile farm list includes only that farmer’s coordinates', function () {
    $account = User::factory()->create(['role' => UserRole::Farmer]);
    $profile = Farmer::factory()->for($account)->create();
    Farm::factory()->for($profile)->create([
        'farm_name' => 'Home Plot',
        'latitude' => 8.25,
        'longitude' => 125.5,
    ]);
    Farm::factory()->create([
        'farm_name' => 'Other Plot',
        'latitude' => 7.1,
        'longitude' => 124.2,
    ]);

    Sanctum::actingAs($account, ['mobile']);

    $response = $this->getJson('/api/mobile/farmer/farms')->assertOk();

    expect($response->json('data.farms'))->toHaveCount(1)
        ->and($response->json('data.farms.0.farm_name'))->toBe('Home Plot')
        ->and($response->json('data.farms.0.latitude'))->toEqual(8.25)
        ->and($response->json('data.farms.0.longitude'))->toEqual(125.5);
});

test('mobile verification notifications stay with the signed-in verifier', function () {
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $other = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $farm = Farm::factory()->create();
    $verifier->notify(new FarmVerificationStatusNotification($farm, 'pending', 'Visit the north plot.'));
    $other->notify(new FarmVerificationStatusNotification($farm, 'pending', 'Secret visit.'));
    $notificationId = $verifier->notifications()->value('id');

    Sanctum::actingAs($verifier, ['mobile']);

    $this->getJson('/api/mobile/verifier/notifications')
        ->assertOk()
        ->assertJsonPath('component', 'mobile/verifier-notifications')
        ->assertJsonPath('data.notifications.data.0.message', 'Visit the north plot.')
        ->assertJsonCount(1, 'data.notifications.data');

    $this->postJson('/api/mobile/verifier/notifications/'.$notificationId.'/read')
        ->assertOk()
        ->assertJsonPath('data.notifications.data.0.read', true);

    Sanctum::actingAs($other, ['mobile']);

    $this->getJson('/api/mobile/verifier/notifications')
        ->assertOk()
        ->assertJsonPath('data.notifications.data.0.message', 'Secret visit.')
        ->assertJsonMissing(['message' => 'Visit the north plot.']);

    $this->postJson('/api/mobile/verifier/notifications/'.$notificationId.'/read')
        ->assertNotFound();

    Sanctum::actingAs(User::factory()->create(), ['mobile']);

    $this->getJson('/api/mobile/verifier/notifications')
        ->assertOk()
        ->assertJsonCount(0, 'data.notifications.data')
        ->assertJsonMissing(['message' => 'Visit the north plot.']);
});

test('mobile verification notifications return 401 without a token', function () {
    $this->getJson('/api/mobile/verifier/notifications')->assertUnauthorized();
});

test('mobile verification notifications return 403 for a role that is not a field verifier', function (UserRole $role) {
    Sanctum::actingAs(User::factory()->create(['role' => $role]), ['mobile']);

    $this->getJson('/api/mobile/verifier/notifications')->assertForbidden();
})->with([
    'farmer' => UserRole::Farmer,
    'operations' => UserRole::Operations,
    'cooperative officer' => UserRole::CooperativeOfficer,
]);

test('a farmer mobile token cannot open administrative api screens', function (string $path) {
    Sanctum::actingAs(User::factory()->create(['role' => UserRole::Farmer]), ['mobile']);

    $this->getJson($path)->assertForbidden();
})->with([
    'farmers' => '/api/mobile/farmers',
    'inventory' => '/api/mobile/inventory',
    'reports' => '/api/mobile/modules/reports',
    'verification review' => '/api/mobile/farm-verification',
]);

test('operations can still load the farmer registry through the mobile api', function () {
    Sanctum::actingAs(User::factory()->create(['role' => UserRole::Operations]), ['mobile']);

    $this->getJson('/api/mobile/farmers')
        ->assertOk()
        ->assertJsonPath('component', 'farmers/index');
});
