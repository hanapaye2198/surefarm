<?php

use App\CropType;
use App\FarmDevelopmentStage;
use App\FarmStatus;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\User;
use App\PropertyOwnership;
use App\UserRole;

function portfolioStaff(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

test('a farmer profile lists every farm and calculates separate area totals', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'middle_name' => null,
        'last_name' => 'Santos',
    ]);

    Farm::factory()->for($farmer)->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Active,
        'property_ownership' => PropertyOwnership::Owned,
        'current_stage' => FarmDevelopmentStage::Harvest,
        'number_of_hills' => 12500,
        'latitude' => 8.1500000,
        'longitude' => 125.1000000,
        'municipality' => 'Kadingilan',
        'province' => 'Bukidnon',
        'contracted_value_estimated' => 150000,
        'input_support_amount' => 12000,
        'financing_support_amount' => 8000,
    ]);

    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Upper Kadingilan Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 1.75,
        'verified_area_hectares' => null,
        'verification_status' => FarmVerificationStatus::Pending,
        'status' => FarmStatus::Active,
        'property_ownership' => PropertyOwnership::Leased,
        'current_stage' => FarmDevelopmentStage::Planting,
        'number_of_hills' => 8200,
        'latitude' => null,
        'longitude' => null,
    ]);

    Farm::factory()->for($farmer)->create([
        'farm_name' => 'Riverside Farm',
        'crop_type' => CropType::Cacao,
        'declared_area_hectares' => 0.90,
        'verified_area_hectares' => 0.90,
        'verification_status' => FarmVerificationStatus::Verified,
        'status' => FarmStatus::Inactive,
        'property_ownership' => PropertyOwnership::Owned,
        'current_stage' => null,
        'number_of_hills' => null,
    ]);

    $this->actingAs(portfolioStaff())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('farmers/show')
            ->has('farmer.farms', 3)
            ->where('farmer.farms.0.number_label', 'Farm 01')
            ->where('farmer.farms.0.farm_name', 'North Coffee Farm')
            ->where('farmer.farms.0.owner_name', 'Maria Santos')
            ->where('farmer.farms.0.status', 'active')
            ->where('farmer.farms.0.verification_status', 'verified')
            ->where('farmer.farms.0.current_stage_label', 'Harvest')
            ->where('farmer.farms.0.property_ownership_label', 'Owned')
            ->where('farmer.farms.0.number_of_hills_label', '12,500')
            ->where('farmer.farms.0.geolocation', 'Captured')
            ->where('farmer.farms.0.declared_area', '2.84 ha')
            ->where('farmer.farms.0.contracted_value', '₱150,000.00')
            ->where('farmer.farms.0.input_support', '₱12,000.00')
            ->where('farmer.farms.0.financing_support', '₱8,000.00')
            ->where('farmer.farms.1.number_label', 'Farm 02')
            ->where('farmer.farms.1.farm_name', 'Upper Kadingilan Farm')
            ->where('farmer.farms.1.status', 'active')
            ->where('farmer.farms.1.verification_status', 'pending')
            ->where('farmer.farms.1.property_ownership_label', 'Leased')
            ->where('farmer.farms.1.current_stage_label', 'Planting')
            ->where('farmer.farms.1.number_of_hills_label', '8,200')
            ->where('farmer.farms.1.geolocation', 'Not yet captured')
            ->where('farmer.farms.1.contracted_value', 'Not provided')
            ->where('farmer.farms.2.number_label', 'Farm 03')
            ->where('farmer.farms.2.farm_name', 'Riverside Farm')
            ->where('farmer.farms.2.status', 'inactive')
            ->where('farmer.farms.2.verification_status', 'verified')
            ->where('farmer.farms.2.number_of_hills_label', 'Not provided')
            ->where('farmer.farms.2.input_support', 'Not provided')
            ->where('farmer.farms.2.financing_support', 'Not provided')
            ->where('farmer.farm_summary.registered_farms', 3)
            ->where('farmer.farm_summary.declared_area_hectares', 5.49)
            ->where('farmer.farm_summary.total_verified_hectares', 3.74)
            ->where('farmer.farm_summary.verified_farms', 2)
            ->where('farmer.farm_summary.pending_verification', 1)
            ->where('farmer.farm_summary.active_crops', 1));

    expect($farmer->farms)->toHaveCount(3)
        ->and($farmer->farms->every(fn (Farm $farm): bool => $farm->farmer_id === $farmer->id))->toBeTrue()
        ->and((float) $farmer->farms()->find(
            Farm::query()->where('farm_name', 'North Coffee Farm')->value('id'),
        )?->declared_area_hectares)->toBe(2.84);
});

test('a farmer with one farm shows that single farm', function () {
    $farmer = Farmer::factory()->create();
    Farm::factory()->for($farmer)->create(['farm_name' => 'Only Farm']);

    $this->actingAs(portfolioStaff())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('farmer.farms', 1)
            ->where('farmer.farms.0.number_label', 'Farm 01')
            ->where('farmer.farms.0.farm_name', 'Only Farm')
            ->where('farmer.farm_summary.registered_farms', 1));
});

test('a farmer with no farms has an empty portfolio', function () {
    $farmer = Farmer::factory()->create();

    $this->actingAs(portfolioStaff())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('farmer.farms', 0)
            ->where('farmer.farm_summary.registered_farms', 0)
            ->where('farmer.farm_summary.declared_area_hectares', 0)
            ->where('farmer.farm_summary.total_verified_hectares', 0));
});

test('updating farm reference data does not replace declared area or verification', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->for($farmer)->create([
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 2.79,
        'verification_status' => FarmVerificationStatus::Verified,
        'crop_type' => CropType::Coffee,
        'status' => FarmStatus::Active,
    ]);
    FarmBoundary::factory()->for($farm)->create([
        'gps_measured_area_hectares' => 2.79,
    ]);

    $this->actingAs(portfolioStaff())
        ->put(route('farms.update', $farm), [
            'farm_name' => 'North Coffee Farm',
            'crop_type' => 'coffee',
            'declared_area_hectares' => '2.84',
            'status' => 'active',
            'current_stage' => 'harvest',
            'number_of_hills' => '12500',
            'property_ownership' => 'owned',
            'data_validated' => '0',
            'verification_status' => 'failed',
            'verified_area_hectares' => '9.99',
        ])
        ->assertRedirect(route('farms.show', $farm));

    $farm->refresh();

    expect((float) $farm->declared_area_hectares)->toBe(2.84)
        ->and((float) $farm->verified_area_hectares)->toBe(2.79)
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and($farm->status)->toBe(FarmStatus::Active)
        ->and($farm->current_stage)->toBe(FarmDevelopmentStage::Harvest)
        ->and($farm->number_of_hills)->toBe(12500)
        ->and($farm->property_ownership)->toBe(PropertyOwnership::Owned)
        ->and($farm->data_validated)->toBeFalse()
        ->and((float) $farm->boundary->gps_measured_area_hectares)->toBe(2.79);
});

test('number of hills must be a whole number when it is provided', function () {
    $farmer = Farmer::factory()->create();

    $this->actingAs(portfolioStaff())
        ->post(route('farmers.farms.store', $farmer), [
            'farm_name' => 'Hill Farm',
            'crop_type' => 'coffee',
            'declared_area_hectares' => '1.50',
            'number_of_hills' => '12.5',
        ])
        ->assertSessionHasErrors('number_of_hills');

    expect(Farm::query()->count())->toBe(0);
});

test('field verifiers can view a farm portfolio but cannot edit farm reference data', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->for($farmer)->create();
    $verifier = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($verifier)
        ->get(route('farmers.show', $farmer))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('farms.edit', $farm))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->put(route('farms.update', $farm), [
            'crop_type' => 'coffee',
            'declared_area_hectares' => '1.00',
            'status' => 'inactive',
        ])
        ->assertForbidden();

    expect($farm->refresh()->status)->toBe(FarmStatus::Active);
});
