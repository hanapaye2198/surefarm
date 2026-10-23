<?php

use App\AccessEventAction;
use App\CooperativeMembershipStatus;
use App\CooperativeStatus;
use App\FarmVerificationStatus;
use App\HarvestStatus;
use App\Models\AccessEvent;
use App\Models\Cooperative;
use App\Models\CooperativeMembership;
use App\Models\CooperativeOfficer;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function cooperativeManager(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

test('an operations user can register and search a cooperative', function () {
    $user = cooperativeManager();

    $this->actingAs($user)
        ->post(route('cooperatives.store'), [
            'name' => 'Island Coffee Cooperative',
            'code' => 'ICC',
        ])
        ->assertRedirect();

    $cooperative = Cooperative::query()->firstOrFail();

    expect($cooperative->status)->toBe(CooperativeStatus::Active)
        ->and(AccessEvent::query()->where('action', AccessEventAction::CooperativeRegistered)->count())->toBe(1);

    $this->actingAs($user)
        ->get(route('cooperatives.index', ['search' => 'Island']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('cooperatives/index')
            ->has('cooperatives.data', 1)
            ->where('cooperatives.data.0.name', 'Island Coffee Cooperative'));

    $this->actingAs($user)
        ->put(route('cooperatives.status.update', $cooperative), ['status' => CooperativeStatus::Inactive->value])
        ->assertRedirect(route('cooperatives.show', $cooperative));

    expect($cooperative->refresh()->status)->toBe(CooperativeStatus::Inactive);
});

test('a farmer has one open membership and history is kept', function () {
    $user = cooperativeManager();
    $first = Cooperative::factory()->create(['name' => 'First Cooperative']);
    $second = Cooperative::factory()->create(['name' => 'Second Cooperative']);
    $farmer = Farmer::factory()->create([
        'farmer_id' => 'SF-000101',
        'government_id' => 'PH-ID-000101',
    ]);

    $this->actingAs($user)
        ->post(route('cooperatives.memberships.store', $first), ['farmer_code' => 'SF-000101'])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('cooperatives.memberships.store', $first), ['farmer_code' => 'SF-000101'])
        ->assertRedirect();

    expect(CooperativeMembership::query()->whereNotNull('open_slot')->count())->toBe(1)
        ->and($farmer->refresh()->cooperative_id)->toBe($first->id);

    $this->actingAs($user)
        ->post(route('cooperatives.memberships.store', $second), ['farmer_code' => 'SF-000101'])
        ->assertSessionHasErrors('farmer_code');

    $membership = CooperativeMembership::query()->firstOrFail();

    $this->actingAs($user)
        ->put(route('cooperatives.memberships.suspend', [$first, $membership]))
        ->assertRedirect();

    expect($membership->refresh()->status)->toBe(CooperativeMembershipStatus::Suspended)
        ->and($farmer->refresh()->cooperative_id)->toBe($first->id);

    $this->actingAs($user)
        ->put(route('cooperatives.memberships.reactivate', [$first, $membership]))
        ->assertRedirect();

    $this->actingAs($user)
        ->put(route('cooperatives.memberships.end', [$first, $membership]))
        ->assertRedirect();

    expect($membership->refresh()->status)->toBe(CooperativeMembershipStatus::Ended)
        ->and($membership->open_slot)->toBeNull()
        ->and($farmer->refresh()->cooperative_id)->toBeNull();

    $this->actingAs($user)
        ->post(route('cooperatives.memberships.store', $second), ['farmer_code' => 'SF-000101'])
        ->assertRedirect();

    expect(CooperativeMembership::query()->count())->toBe(2)
        ->and($farmer->refresh()->cooperative_id)->toBe($second->id)
        ->and(AccessEvent::query()->where('action', AccessEventAction::MembershipEnded)->count())->toBe(1);
});

test('an inactive cooperative cannot accept a member', function () {
    $user = cooperativeManager();
    $cooperative = Cooperative::factory()->create(['status' => CooperativeStatus::Inactive]);
    $farmer = Farmer::factory()->create(['farmer_id' => 'SF-000202']);

    $this->actingAs($user)
        ->post(route('cooperatives.memberships.store', $cooperative), ['farmer_code' => 'SF-000202'])
        ->assertSessionHasErrors('farmer_code');

    expect($farmer->refresh()->cooperative_id)->toBeNull()
        ->and(CooperativeMembership::query()->count())->toBe(0);
});

test('a cooperative officer sees only the assigned cooperative', function () {
    $manager = cooperativeManager();
    $assigned = Cooperative::factory()->create(['name' => 'Assigned Cooperative']);
    $other = Cooperative::factory()->create(['name' => 'Other Cooperative']);
    $member = Farmer::factory()->create([
        'farmer_id' => 'SF-000303',
        'government_id' => 'PH-ID-000303',
        'province' => 'Bukidnon',
    ]);
    $outsider = Farmer::factory()->create([
        'farmer_id' => 'SF-000404',
        'province' => 'Bukidnon',
    ]);
    Farm::factory()->for($member)->create([
        'verification_status' => FarmVerificationStatus::Verified,
        'province' => 'Bukidnon',
    ]);
    FarmHarvest::factory()->create([
        'farm_id' => $member->farms()->firstOrFail()->id,
        'quantity' => 12,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
        'harvest_date' => '2026-10-02',
    ]);

    $this->actingAs($manager)
        ->post(route('cooperatives.memberships.store', $assigned), ['farmer_code' => 'SF-000303'])
        ->assertRedirect();

    $this->actingAs($manager)
        ->post(route('cooperatives.memberships.store', $other), ['farmer_code' => 'SF-000404'])
        ->assertRedirect();

    $officer = User::factory()->create([
        'role' => UserRole::CooperativeOfficer,
        'email' => 'officer@surefarm.test',
    ]);

    $this->actingAs($manager)
        ->post(route('cooperatives.officers.store', $assigned), ['email' => 'officer@surefarm.test'])
        ->assertRedirect();

    $this->actingAs($officer)
        ->get(route('cooperatives.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('cooperatives.data', 1)
            ->where('cooperatives.data.0.name', 'Assigned Cooperative'));

    $this->actingAs($officer)
        ->get(route('cooperatives.show', $assigned))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('cooperatives/show')
            ->where('stats.active_members', 1)
            ->where('stats.farms', 1)
            ->where('stats.verified_farms', 1)
            ->where('harvests.0.label', '12 kg')
            ->where('can_manage', false));

    $this->actingAs($officer)
        ->get(route('cooperatives.show', $other))
        ->assertNotFound();

    $this->actingAs($officer)
        ->get(route('farmers.show', $member))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.government_id', null)
            ->where('farmer.bank_account', null));

    $this->actingAs($officer)
        ->get(route('farmers.show', $outsider))
        ->assertNotFound();

    $this->actingAs($officer)
        ->post(route('cooperatives.memberships.store', $assigned), ['farmer_code' => 'SF-000303'])
        ->assertForbidden();
});

test('a province scoped manager cannot enroll a farmer outside that province', function () {
    $manager = cooperativeManager();
    $manager->registryGrants()->update(['revoked_at' => now()]);
    RegistryGrant::factory()->create([
        'user_id' => $manager->id,
        'kind' => RegistryGrantKind::Province,
        'province' => 'Bukidnon',
    ]);
    $cooperative = Cooperative::factory()->create();
    Farmer::factory()->create([
        'farmer_id' => 'SF-HIDDEN',
        'province' => 'Davao del Sur',
    ]);

    $this->actingAs($manager)
        ->post(route('cooperatives.memberships.store', $cooperative), ['farmer_code' => 'SF-HIDDEN'])
        ->assertSessionHasErrors('farmer_code');

    expect(CooperativeMembership::query()->count())->toBe(0);
});

test('changing an officer role ends the cooperative assignment', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);
    $officer = User::factory()->create(['role' => UserRole::CooperativeOfficer]);
    $cooperative = Cooperative::factory()->create();
    $assignment = CooperativeOfficer::factory()->create([
        'user_id' => $officer->id,
        'cooperative_id' => $cooperative->id,
        'revoked_at' => null,
    ]);

    $this->actingAs($admin)
        ->patch(route('users.update', $officer), ['role' => UserRole::Farmer->value])
        ->assertRedirect();

    expect($assignment->refresh()->revoked_at)->not->toBeNull();
});
