<?php

use App\CropType;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('summary.registered_farmers', 0)
            ->where('summary.registered_farms', 0)
            ->where('summary.total_coffee_farm_area_hectares', 0)
            ->where('summary.verified_farms', 0)
            ->where('summary.pending_verification', 0)
            ->where('summary.in_progress', 0)
            ->where('summary.needs_review', 0)
            ->where('summary.failed', 0)
            ->where('area_summary.total_declared_hectares', 0)
            ->where('area_summary.total_verified_hectares', 0)
            ->where('area_summary.coffee_hectares', 0)
            ->where('area_summary.other_crop_hectares', 0)
            ->where('locations', [])
            ->where('verified_lands', []));
});

test('dashboard statistics use declared area and active farm status', function () {
    $farmer = Farmer::factory()->create();

    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000010',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 4,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Active,
        'latitude' => 8.1575,
        'longitude' => 125.1278,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 9,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Inactive,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'crop_type' => CropType::Corn,
        'declared_area_hectares' => 3,
        'verification_status' => FarmVerificationStatus::Pending,
        'status' => FarmStatus::Active,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000099',
        'farm_name' => 'South Plot',
        'crop_type' => CropType::Corn,
        'declared_area_hectares' => 1.5,
        'verification_status' => FarmVerificationStatus::Pending,
        'status' => FarmStatus::Inactive,
        'latitude' => 8.2,
        'longitude' => 125.2,
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.registered_farmers', 1)
            ->where('summary.registered_farms', 4)
            ->where('summary.total_coffee_farm_area_hectares', 4)
            ->where('summary.verified_farms', 1)
            ->where('summary.pending_verification', 1)
            ->where('area_summary.total_declared_hectares', 7)
            ->where('area_summary.total_verified_hectares', 0)
            ->where('area_summary.coffee_hectares', 4)
            ->where('area_summary.other_crop_hectares', 3)
            ->has('locations', 2)
            ->where('locations.0.farm_id', 'FARM-000010')
            ->where('locations.0.verification_status', 'verified')
            ->where('locations.0.declared_area_hectares', 4)
            ->where('locations.1.farm_id', 'FARM-000099')
            ->where('locations.1.verification_status', 'pending')
            ->where('locations.1.declared_area_hectares', 1.5)
            ->where('locations.1.latitude', 8.2)
            ->where('locations.1.longitude', 125.2)
            ->where('verified_lands', []));
});

test('dashboard verified farm land includes only active verified boundaries', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Ana',
        'middle_name' => null,
        'last_name' => 'Reyes',
    ]);
    $boundary = [
        'type' => 'Polygon',
        'coordinates' => [[
            [125.1278, 8.1575],
            [125.1288, 8.1575],
            [125.1288, 8.1585],
            [125.1278, 8.1585],
            [125.1278, 8.1575],
        ]],
    ];
    $verified = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000021',
        'farm_name' => 'North Plot',
        'crop_type' => CropType::Coffee,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Active,
        'verified_area_hectares' => 2.79,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $verified->id,
        'boundary_geojson' => $boundary,
    ]);
    $inactive = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Inactive,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $inactive->id,
    ]);
    $pending = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'verification_status' => FarmVerificationStatus::Pending,
        'status' => FarmStatus::Active,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $pending->id,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Active,
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('verified_lands', 1)
            ->where('verified_lands.0.farm_id', 'FARM-000021')
            ->where('verified_lands.0.farm_name', 'North Plot')
            ->where('verified_lands.0.farmer_name', 'Ana Reyes')
            ->where('verified_lands.0.crop_label', 'Coffee')
            ->where('verified_lands.0.verified_area_hectares', 2.79)
            ->where('verified_lands.0.boundary', $boundary)
            ->has('locations', 0));
});
