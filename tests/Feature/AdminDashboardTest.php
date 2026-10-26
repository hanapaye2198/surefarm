<?php

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function provinceAdmin(string $province): User
{
    $admin = User::factory()->create();
    $admin->registryGrants()->update(['revoked_at' => now()]);

    RegistryGrant::factory()->create([
        'user_id' => $admin->id,
        'kind' => RegistryGrantKind::Province,
        'province' => $province,
    ]);

    return $admin->fresh();
}

test('operations staff keep the operations dashboard', function () {
    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->missing('registry'));
});

test('an administrator sees full-registry land analytics and farms without a boundary', function () {
    $admin = provinceAdmin('Bukidnon');
    $farmer = Farmer::factory()->create([
        'first_name' => 'Ana',
        'middle_name' => null,
        'last_name' => 'Reyes',
        'farmer_id' => 'SF-000501',
        'province' => 'Bukidnon',
        'municipality' => 'Malaybalay',
    ]);
    $verified = Farm::factory()->for($farmer)->create([
        'farm_id' => 'FARM-000501',
        'farm_name' => 'North Plot',
        'province' => 'Bukidnon',
        'municipality' => 'Malaybalay',
        'barangay' => 'Sumpong',
        'declared_area_hectares' => 4,
        'verified_area_hectares' => 2.79,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Active,
        'crop_type' => CropType::Coffee,
        'latitude' => 8.15,
        'longitude' => 125.12,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $verified->id,
    ]);
    Farm::factory()->for($farmer)->create([
        'farm_id' => 'FARM-000502',
        'farm_name' => 'South Plot',
        'province' => 'Bukidnon',
        'municipality' => 'Malaybalay',
        'barangay' => 'Sumpong',
        'declared_area_hectares' => 1.25,
        'verification_status' => FarmVerificationStatus::Pending,
        'status' => FarmStatus::Active,
        'crop_type' => CropType::Coffee,
        'latitude' => 8.16,
        'longitude' => 125.13,
    ]);
    Farm::factory()->create([
        'province' => 'Misamis Oriental',
        'declared_area_hectares' => 9,
        'verified_area_hectares' => 9,
        'verification_status' => FarmVerificationStatus::Verified,
        'latitude' => 8.5,
        'longitude' => 124.6,
    ]);

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin-dashboard')
            ->where('registry.scope', 'Entire registry')
            ->where('registry.metrics.0.display', '2')
            ->where('registry.metrics.1.display', '3')
            ->where('registry.metrics.2.display', '14.25 ha')
            ->where('registry.metrics.3.display', '11.79 ha')
            ->where('registry.metrics.4.display', '1.25 ha')
            ->where('registry.metrics.9.display', '2')
            ->where('registry.farms.total', 3)
            ->where('registry.charts.comparison.0.hectares', 14.25)
            ->where('registry.charts.comparison.1.hectares', 11.79)
            ->where('registry.charts.geography.rows.0.declared_hectares', 9)
            ->where('registry.charts.owners.1.farmer_name', 'Ana Reyes')
            ->where('registry.charts.owners.1.farms', 2)
            ->where('registry.charts.owners.1.declared_hectares', 5.25)
            ->where('registry.charts.crops.0.declared_hectares', 14.25)
            ->has('registry.charts.crops', 1)
            ->where('registry.charts.statuses.0.farms', 1)
            ->where('registry.charts.statuses.0.declared_hectares', 1.25)
            ->where('registry.charts.statuses.2.farms', 2)
            ->has('registry.map.features', 3));

    $this->actingAs($admin)
        ->get(route('dashboard', ['layer' => 'boundaries']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.map.matched', 1)
            ->where('registry.map.features.0.farm_id', 'FARM-000501')
            ->where('registry.farms.total', 3));

    $this->actingAs($admin)
        ->get(route('dashboard', ['layer' => 'verified']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.map.matched', 1)
            ->where('registry.map.features.0.boundary.type', 'Polygon'));

    $this->actingAs($admin)
        ->get(route('dashboard', ['verification_status' => 'pending']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.farms.total', 1)
            ->where('registry.farms.data.0.farm_id', 'FARM-000502')
            ->where('registry.metrics.2.display', '1.25 ha')
            ->where('registry.map.matched', 1));

    $this->actingAs($admin)
        ->get(route('dashboard', ['crop' => 'corn']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.farms.total', 0)
            ->where('registry.metrics.2.display', '0.00 ha')
            ->has('registry.charts.crops', 0));
});

test('registry filters search sort paginate and use the registration date', function () {
    $admin = User::factory()->create();
    $farmer = Farmer::factory()->create([
        'first_name' => 'Ana',
        'middle_name' => null,
        'last_name' => 'Reyes',
    ]);
    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Large Plot',
        'declared_area_hectares' => 3,
        'created_at' => now()->subDays(40),
        'updated_at' => now()->subDays(40),
    ]);
    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Middle Plot',
        'declared_area_hectares' => 2,
    ]);
    foreach (range(1, 8) as $index) {
        Farm::factory()->for($farmer)->create([
            'farm_name' => 'Plot '.$index,
            'declared_area_hectares' => 1,
        ]);
    }
    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Small Plot',
        'declared_area_hectares' => 0.5,
    ]);

    $this->actingAs($admin)
        ->get(route('dashboard', [
            'search' => 'Ana Reyes',
            'sort' => 'declared_area',
            'direction' => 'desc',
            'per_page' => 10,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.farms.total', 11)
            ->has('registry.farms.data', 10)
            ->where('registry.farms.data.0.farm_name', 'Large Plot')
            ->where('registry.farms.data.1.farm_name', 'Middle Plot'));

    $this->actingAs($admin)
        ->get(route('dashboard', [
            'search' => 'Ana Reyes',
            'per_page' => 10,
            'page' => 2,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('registry.farms.data', 1)
            ->where('registry.farms.data.0.farm_name', 'Small Plot'));

    $this->actingAs($admin)
        ->get(route('dashboard', [
            'registered_from' => now()->toDateString(),
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.farms.total', 10)
            ->where('registry.metrics.2.display', '10.50 ha'));
});

test('an empty authorized registry renders zero without inventing land', function () {
    $admin = provinceAdmin('Bukidnon');

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin-dashboard')
            ->where('registry.metrics.1.display', '0')
            ->where('registry.metrics.2.display', '0.00 ha')
            ->where('registry.metrics.3.display', '0.00 ha')
            ->where('registry.farms.data', [])
            ->where('registry.map.features', [])
            ->where('registry.insights', [])
            ->where('registry.charts.trend.monthly', false)
            ->has('registry.charts.trend.points', 30));
});

test('an administrator sees one trend point for each month of the year to date', function () {
    $this->travelTo('2026-03-15 12:00:00');

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard', ['trend' => 'ytd']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('registry.charts.trend.monthly', true)
            ->has('registry.charts.trend.points', 3)
            ->where('registry.charts.trend.points.0.label', 'Jan 2026')
            ->where('registry.charts.trend.points.2.label', 'Mar 2026'));
});

test('an unknown registry filter is rejected', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard', ['verification_status' => 'nope']))
        ->assertSessionHasErrors('verification_status');
});
