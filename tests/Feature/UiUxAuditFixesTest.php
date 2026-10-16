<?php

use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmInsurance;
use App\Models\FarmVerification;
use App\Models\User;
use App\Notifications\FarmerRegistrationReceivedNotification;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

test('finance and insurance lists open the existing farm records', function () {
    $user = User::factory()->create(['role' => UserRole::Operations]);
    $farm = Farm::factory()->create(['farm_name' => 'North Plot']);
    FarmInsurance::factory()->for($farm)->create();
    FarmFinancing::factory()->for($farm)->create();

    $this->actingAs($user)
        ->get(route('insurance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('coverage/index')
            ->where('kind', 'insurance')
            ->where('records.data.0.farm_name', 'North Plot'));

    $this->actingAs($user)
        ->get(route('finance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('coverage/index')
            ->where('kind', 'financing')
            ->where('records.data.0.farm_name', 'North Plot'));
});

test('a farmer account cannot open the finance list', function () {
    $this->actingAs(User::factory()->create(['role' => UserRole::Farmer]))
        ->get(route('finance.index'))
        ->assertForbidden();
});

test('register farm asks for an existing farmer', function () {
    $user = User::factory()->create(['role' => UserRole::Operations]);
    $farmer = Farmer::factory()->create(['first_name' => 'Liza', 'last_name' => 'Cruz']);

    $this->actingAs($user)
        ->get(route('farms.register'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farms/register')
            ->where('farmers.data.0.id', $farmer->id)
            ->where('farmers.data.0.name', $farmer->fullName()));
});

test('search returns authorized farmer and farm records', function () {
    $user = User::factory()->create(['role' => UserRole::Operations]);
    $farmer = Farmer::factory()->create([
        'first_name' => 'Remedios',
        'last_name' => 'Bautista',
    ]);
    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Remedios Ridge',
        'municipality' => 'Kadingilan',
    ]);

    $this->actingAs($user)
        ->getJson(route('search', ['q' => 'Remedios']))
        ->assertOk()
        ->assertJsonPath('available', true)
        ->assertJsonFragment(['title' => $farmer->fullName()])
        ->assertJsonFragment(['title' => 'Remedios Ridge']);
});

test('search does not expose records to a farmer account', function () {
    Farmer::factory()->create(['first_name' => 'Hidden', 'last_name' => 'Farmer']);

    $this->actingAs(User::factory()->create(['role' => UserRole::Farmer]))
        ->getJson(route('search', ['q' => 'Hidden']))
        ->assertOk()
        ->assertJsonPath('available', false)
        ->assertJsonPath('results', []);
});

test('notifications come from the signed-in account', function () {
    $owner = User::factory()->create(['role' => UserRole::Farmer]);
    $other = User::factory()->create(['role' => UserRole::Farmer]);
    $farmer = Farmer::factory()->for($owner)->create();
    $owner->notify(new FarmerRegistrationReceivedNotification($farmer));

    $this->actingAs($other)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonPath('notifications', [])
        ->assertJsonPath('unread_count', 0);

    $notificationId = $owner->notifications()->value('id');

    $this->actingAs($owner)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonPath('unread_count', 1)
        ->assertJsonPath('notifications.0.title', 'Farmer registration received');

    $this->actingAs($owner)
        ->postJson(route('notifications.read', $notificationId))
        ->assertOk()
        ->assertJsonPath('unread_count', 0);

    $this->actingAs($other)
        ->postJson(route('notifications.read', $notificationId))
        ->assertNotFound();
});

test('a farmer profile lists stored verification history', function () {
    $user = User::factory()->create(['role' => UserRole::Operations]);
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->for($farmer)->create(['farm_name' => 'History Farm']);
    FarmVerification::factory()->for($farm)->create([
        'verification_reference' => 'VER-100001',
        'remarks' => 'Boundary checked',
    ]);

    $this->actingAs($user)
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farmers/show')
            ->where('farmer.verification_history.0.reference', 'VER-100001')
            ->where('farmer.verification_history.0.farm_name', 'History Farm')
            ->where('farmer.verification_history.0.remarks', 'Boundary checked'));
});
