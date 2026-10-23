<?php

use App\AccessEventAction;
use App\Actions\DecideFarmVerification;
use App\Actions\StartFarmVerification;
use App\FarmVerificationResult;
use App\Models\AccessEvent;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;

test('guests cannot open the registry', function () {
    $this->get(route('farmers.index'))->assertRedirect(route('login'));
    $this->get(route('farms.index'))->assertRedirect(route('login'));
});

test('a suspended account cannot keep using an existing session', function () {
    $admin = User::factory()->create();
    $staff = User::factory()->create(['role' => UserRole::Operations]);

    $this->actingAs($admin)
        ->post(route('users.suspension.store', $staff))
        ->assertRedirect(route('users.index'));

    $this->actingAs($staff->fresh())
        ->get(route('farmers.index'))
        ->assertRedirect(route('login'));
});

test('a linked farmer can open their own farm and not another farmers farm', function () {
    $admin = User::factory()->create();
    $account = User::factory()->create(['role' => UserRole::Farmer]);
    $farmer = Farmer::factory()->create(['farmer_id' => 'SF-000101']);
    $ownFarm = Farm::factory()->for($farmer)->create();
    $otherFarm = Farm::factory()->create();

    $this->actingAs($admin)
        ->post(route('users.farmer-link.store', $account), [
            'farmer_code' => 'SF-000101',
        ])
        ->assertRedirect(route('users.show', $account));

    $this->actingAs($account)
        ->get(route('farms.show', $ownFarm))
        ->assertOk();

    $this->actingAs($account)
        ->get(route('farms.show', $otherFarm))
        ->assertNotFound();

    $this->actingAs($account)
        ->get(route('farmers.photo', $otherFarm->farmer))
        ->assertNotFound();
});

test('a farmer cannot link an account or rewrite the farmer link', function () {
    $account = User::factory()->create(['role' => UserRole::Farmer]);
    $farmer = Farmer::factory()->create();
    $staff = User::factory()->create(['role' => UserRole::Operations]);

    $this->actingAs($account)
        ->post(route('users.farmer-link.store', $account), [
            'farmer_code' => $farmer->farmer_id,
        ])
        ->assertForbidden();

    $this->actingAs($staff)
        ->put(route('farmers.update', $farmer), [
            'date_of_birth' => '1980-05-12',
            'government_id' => 'PH-ID-000124',
            'has_bank_account' => false,
            'user_id' => $account->id,
        ])
        ->assertRedirect(route('farmers.show', $farmer));

    expect($farmer->refresh()->user_id)->toBeNull();
});

test('a farmer record can be linked once and is not matched by email', function () {
    $admin = User::factory()->create();
    $first = User::factory()->create(['role' => UserRole::Farmer]);
    $second = User::factory()->create(['role' => UserRole::Farmer]);
    $farmer = Farmer::factory()->create([
        'farmer_id' => 'SF-000202',
        'email' => $second->email,
    ]);

    $this->actingAs($admin)
        ->post(route('users.farmer-link.store', $first), [
            'farmer_code' => $second->email,
        ])
        ->assertSessionHasErrors('farmer_code');

    $this->actingAs($admin)
        ->post(route('users.farmer-link.store', $first), [
            'farmer_code' => 'SF-000202',
        ])
        ->assertRedirect(route('users.show', $first));

    $this->actingAs($admin)
        ->from(route('users.show', $second))
        ->post(route('users.farmer-link.store', $second), [
            'farmer_code' => 'SF-000202',
        ])
        ->assertRedirect(route('users.show', $second))
        ->assertSessionHasErrors('farmer_code');

    expect($farmer->refresh()->user_id)->toBe($first->id)
        ->and(AccessEvent::query()->where('action', AccessEventAction::FarmerLinked)->count())->toBe(1);
});

test('a field verifier can open an assigned farm and not an unassigned farm', function () {
    $admin = User::factory()->create();
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $assigned = Farm::factory()->create(['farm_id' => 'FARM-000301']);
    $hidden = Farm::factory()->create([
        'latitude' => 7.1,
        'longitude' => 125.1,
    ]);

    $this->actingAs($admin)
        ->post(route('users.farm-assignments.store', $verifier), [
            'farm_code' => 'FARM-000301',
        ])
        ->assertRedirect(route('users.show', $verifier));

    $this->actingAs($verifier)
        ->get(route('farms.show', $assigned))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('farms.show', $hidden))
        ->assertNotFound();

    $this->actingAs($verifier)
        ->get(route('farms.drone-image', $hidden))
        ->assertNotFound();

    $this->actingAs($verifier)
        ->post(route('farms.financing.store', $assigned), [
            'amount' => '1000',
            'date_granted' => '2026-06-15',
            'loan_balance' => '1000',
            'financing_type' => 'mm',
        ])
        ->assertForbidden();

    $this->actingAs($verifier)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('locations', 0));

    expect(AccessEvent::query()->where('action', AccessEventAction::AssignmentCreated)->exists())->toBeTrue();
});

test('an unassigned verifier cannot start verification directly', function () {
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $farm = Farm::factory()->create();

    expect(fn () => app(StartFarmVerification::class)->handle($farm, $verifier))
        ->toThrow(HttpException::class);

    expect(fn () => app(DecideFarmVerification::class)->handle(
        $farm,
        $verifier,
        FarmVerificationResult::Verified,
        'Approve it.',
    ))->toThrow(HttpException::class);
});

test('operations staff cannot read or submit a farmer outside their province', function () {
    $staff = User::factory()->create(['role' => UserRole::Operations]);
    $staff->registryGrants()->update(['revoked_at' => now()]);
    RegistryGrant::query()->create([
        'user_id' => $staff->id,
        'kind' => RegistryGrantKind::Province,
        'province' => 'Bukidnon',
    ]);

    $visible = Farmer::factory()->create([
        'first_name' => 'Visible',
        'province' => 'Bukidnon',
    ]);
    $hidden = Farmer::factory()->create([
        'first_name' => 'Hidden',
        'province' => 'Davao del Sur',
    ]);
    $hiddenFarm = Farm::factory()->for($hidden)->create([
        'province' => 'Davao del Sur',
        'latitude' => 7.2,
        'longitude' => 125.6,
    ]);
    $visibleFarm = Farm::factory()->for($visible)->create([
        'province' => 'Bukidnon',
        'latitude' => 8.1,
        'longitude' => 125.1,
    ]);

    $this->actingAs($staff)
        ->get(route('farmers.index', ['search' => 'Hidden']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('farmers.data', 0));

    $this->actingAs($staff)
        ->get(route('farmers.show', $hidden))
        ->assertNotFound();

    $this->actingAs($staff)
        ->get(route('farmers.show', $visible))
        ->assertOk();

    $this->actingAs($staff)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('locations', 1)
            ->where('locations.0.id', $visibleFarm->id));

    $this->actingAs($staff)
        ->post(route('farm-activities.store'), [
            'farm_id' => $hiddenFarm->id,
            'activity_date' => '2026-10-01',
        ])
        ->assertNotFound();
});

test('an administrator without a platform grant cannot read the registry', function () {
    $admin = User::factory()->create();
    $admin->registryGrants()->update(['revoked_at' => now()]);
    $farmer = Farmer::factory()->create();

    $this->actingAs($admin->fresh())
        ->get(route('farmers.show', $farmer))
        ->assertNotFound();
});

test('a user cannot change their own role or another users role without permission', function () {
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);
    $operations = User::factory()->create(['role' => UserRole::Operations]);

    $this->actingAs($farmer)
        ->patch(route('users.update', $farmer), [
            'role' => UserRole::Admin->value,
        ])
        ->assertForbidden();

    $this->actingAs($operations)
        ->patch(route('users.update', $farmer), [
            'role' => UserRole::Admin->value,
        ])
        ->assertForbidden();

    expect($farmer->refresh()->role)->toBe(UserRole::Farmer);
});

test('the last administrator cannot remove their own platform access', function () {
    $admin = User::factory()->create();
    $grant = $admin->registryGrants()->firstOrFail();

    $this->actingAs($admin)
        ->from(route('users.show', $admin))
        ->delete(route('users.registry-grants.destroy', [$admin, $grant]))
        ->assertRedirect(route('users.show', $admin))
        ->assertSessionHasErrors('grant');

    expect($grant->refresh()->revoked_at)->toBeNull();

    $this->actingAs($admin)
        ->from(route('users.show', $admin))
        ->post(route('users.registry-grants.store', $admin), [
            'kind' => 'province',
            'province' => 'Bukidnon',
        ])
        ->assertRedirect(route('users.show', $admin))
        ->assertSessionHasErrors('kind');
});
