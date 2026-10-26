<?php

use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array{type: string, coordinates: list<list<array{0: float, 1: float}>>}
 */
function fieldSquare(float $longitude, float $latitude, float $size = 0.002): array
{
    return [
        'type' => 'Polygon',
        'coordinates' => [[
            [$longitude, $latitude],
            [$longitude + $size, $latitude],
            [$longitude + $size, $latitude + $size],
            [$longitude, $latitude + $size],
            [$longitude, $latitude],
        ]],
    ];
}

test('the farm map reports overlap, nearby fields, and a verified-area mismatch', function () {
    $farmer = Farmer::factory()->create();
    $otherFarmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-ACTIVE',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
        'declared_area_hectares' => 5.88,
        'verified_area_hectares' => 18.64,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $farm->id,
        'boundary_geojson' => fieldSquare(125.10, 8.10),
        'gps_measured_area_hectares' => 5.88,
    ]);
    $overlap = Farm::factory()->create([
        'farmer_id' => $otherFarmer->id,
        'farm_id' => 'FARM-OVERLAP',
        'farm_name' => 'Overlap Plot',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $overlap->id,
        'boundary_geojson' => fieldSquare(125.101, 8.10),
        'gps_measured_area_hectares' => 5.88,
    ]);
    $adjacent = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-ADJACENT',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $adjacent->id,
        'boundary_geojson' => fieldSquare(125.102, 8.10),
    ]);
    $sameFarmer = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-SAME-FARMER',
        'municipality' => 'Valencia',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $sameFarmer->id,
        'boundary_geojson' => fieldSquare(126.20, 8.10),
    ]);
    $far = Farm::factory()->create([
        'farmer_id' => $otherFarmer->id,
        'farm_id' => 'FARM-FAR',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $far->id,
        'boundary_geojson' => fieldSquare(126.40, 8.10),
    ]);

    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.boundary_review.mismatch.active_hectares', 5.88)
            ->where('farm.boundary_review.mismatch.verified_hectares', 18.64)
            ->has('farm.boundary_review.overlaps', 1)
            ->where('farm.boundary_review.overlaps.0.farm_id', 'FARM-OVERLAP')
            ->where('farm.boundary_review.overlaps.0.farm_name', 'Overlap Plot')
            ->where('farm.boundary_review.overlaps.0.percent', 50)
            ->has('farm.boundary_review.neighbors', 3)
            ->where('farm.boundary_review.neighbors.0.farm_id', 'FARM-OVERLAP')
            ->where('farm.boundary_review.neighbors.0.overlap_percent', 50)
            ->where('farm.boundary_review.neighbors.1.farm_id', 'FARM-ADJACENT')
            ->where('farm.boundary_review.neighbors.1.overlap_percent', null)
            ->where('farm.boundary_review.neighbors.2.farm_id', 'FARM-SAME-FARMER')
            ->where('farm.boundary_review.neighbors.2.overlap_percent', null));
});

test('a matching verified area does not raise a boundary mismatch', function () {
    $farm = Farm::factory()->create([
        'verified_area_hectares' => 2.50,
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $farm->id,
        'boundary_geojson' => fieldSquare(125.10, 8.10),
        'gps_measured_area_hectares' => 2.50,
    ]);

    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.boundary_review.mismatch', null)
            ->has('farm.boundary_review.overlaps', 0)
            ->has('farm.boundary_review.neighbors', 0));
});

test('a farmer does not receive another farmers overlapping boundary', function () {
    $admin = User::factory()->create();
    $account = User::factory()->create(['role' => UserRole::Farmer]);
    $farmer = Farmer::factory()->create(['farmer_id' => 'SF-000301']);
    $otherFarmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $farm->id,
        'boundary_geojson' => fieldSquare(125.10, 8.10),
    ]);
    $ownOther = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-OWN-OTHER',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $ownOther->id,
        'boundary_geojson' => fieldSquare(125.102, 8.10),
    ]);
    $other = Farm::factory()->create([
        'farmer_id' => $otherFarmer->id,
        'farm_id' => 'FARM-OTHER',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $other->id,
        'boundary_geojson' => fieldSquare(125.101, 8.10),
    ]);

    $this->actingAs($admin)
        ->post(route('users.farmer-link.store', $account), [
            'farmer_code' => 'SF-000301',
        ])
        ->assertRedirect();

    $this->actingAs($account)
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('farm.boundary_review.neighbors', 1)
            ->where('farm.boundary_review.neighbors.0.farm_id', 'FARM-OWN-OTHER')
            ->has('farm.boundary_review.overlaps', 0));
});
