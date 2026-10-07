<?php

use App\CropType;
use App\FarmVerificationStatus;
use App\HarvestStatus;
use App\Models\Farm;
use App\Models\FarmActivity;
use App\Models\Farmer;
use App\Models\FarmHarvest;
use App\Models\FarmProduction;
use App\Models\User;
use App\ProductionStatus;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function productionOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function productionPayload(Farm $farm, array $overrides = []): array
{
    return [
        'farm_id' => $farm->id,
        'crop_type' => $farm->crop_type->value,
        'production_period' => '2026',
        'expected_quantity' => 1200,
        'unit' => 'kg',
        'notes' => 'Coffee estimate',
        'status' => ProductionStatus::Active->value,
        ...$overrides,
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function harvestPayload(Farm $farm, array $overrides = []): array
{
    return [
        'farm_id' => $farm->id,
        'crop_type' => $farm->crop_type->value,
        'production_id' => null,
        'harvest_date' => '2026-10-07',
        'quantity' => 300,
        'unit' => 'kg',
        'quality_grade' => 'Grade A',
        'status' => HarvestStatus::Completed->value,
        'notes' => null,
        ...$overrides,
    ];
}

test('production can be created for a farm without changing area or verification', function () {
    $farm = Farm::factory()->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 28.09,
        'verification_status' => FarmVerificationStatus::Verified,
    ]);

    $this->actingAs(productionOperationsUser())
        ->post(route('production.store'), productionPayload($farm))
        ->assertRedirect();

    $production = FarmProduction::query()->firstOrFail();

    expect($production->farm_id)->toBe($farm->id)
        ->and($production->crop_type)->toBe(CropType::Coffee)
        ->and((float) $production->expected_quantity)->toBe(1200.0)
        ->and($production->unit)->toBe('kg')
        ->and($production->status)->toBe(ProductionStatus::Active);

    $farm->refresh();

    expect((float) $farm->declared_area_hectares)->toBe(2.84)
        ->and((float) $farm->verified_area_hectares)->toBe(28.09)
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and(FarmActivity::query()->count())->toBe(0);
});

test('production expected quantity must be greater than zero when provided', function () {
    $farm = Farm::factory()->create();
    $user = productionOperationsUser();

    $this->actingAs($user)
        ->post(route('production.store'), productionPayload($farm, ['expected_quantity' => 0]))
        ->assertSessionHasErrors('expected_quantity');

    $this->actingAs($user)
        ->post(route('production.store'), productionPayload($farm, ['expected_quantity' => -5]))
        ->assertSessionHasErrors('expected_quantity');

    $this->actingAs($user)
        ->post(route('production.store'), productionPayload($farm, ['expected_quantity' => null]))
        ->assertRedirect();

    expect(FarmProduction::query()->whereNull('expected_quantity')->count())->toBe(1);
});

test('a harvest can be created for a farm and linked to a production record', function () {
    $farm = Farm::factory()->create([
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 28.09,
        'verification_status' => FarmVerificationStatus::Verified,
    ]);
    $production = FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'expected_quantity' => 1200,
        'unit' => 'kg',
    ]);
    $user = productionOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, [
            'production_id' => $production->id,
            'quantity' => 300,
        ]))
        ->assertRedirect(route('production.show', $production));

    $harvest = FarmHarvest::query()->firstOrFail();

    expect($harvest->farm_id)->toBe($farm->id)
        ->and($harvest->production_id)->toBe($production->id)
        ->and((float) $harvest->quantity)->toBe(300.0)
        ->and($harvest->created_by)->toBe($user->id);

    $production->refresh();
    $farm->refresh();

    expect((float) $production->expected_quantity)->toBe(1200.0)
        ->and((float) $farm->declared_area_hectares)->toBe(2.84)
        ->and((float) $farm->verified_area_hectares)->toBe(28.09)
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and(FarmActivity::query()->count())->toBe(0);
});

test('harvest quantity must be greater than zero and the date is required', function () {
    $farm = Farm::factory()->create();
    $user = productionOperationsUser();

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, ['quantity' => 0]))
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, ['quantity' => -10]))
        ->assertSessionHasErrors('quantity');

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, ['harvest_date' => null]))
        ->assertSessionHasErrors('harvest_date');

    expect(FarmHarvest::query()->count())->toBe(0);
});

test('a crop or production record from another farm is rejected', function () {
    $farm = Farm::factory()->create(['crop_type' => CropType::Coffee]);
    $other = Farm::factory()->create(['crop_type' => CropType::Cacao]);
    $otherProduction = FarmProduction::factory()->create([
        'farm_id' => $other->id,
        'crop_type' => CropType::Cacao,
    ]);
    $user = productionOperationsUser();

    $this->actingAs($user)
        ->post(route('production.store'), productionPayload($farm, [
            'crop_type' => CropType::Cacao->value,
        ]))
        ->assertSessionHasErrors('crop_type');

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, [
            'crop_type' => CropType::Cacao->value,
        ]))
        ->assertSessionHasErrors('crop_type');

    $this->actingAs($user)
        ->post(route('harvest.store'), harvestPayload($farm, [
            'production_id' => $otherProduction->id,
        ]))
        ->assertSessionHasErrors('production_id');

    expect(FarmProduction::query()->where('farm_id', $farm->id)->count())->toBe(0)
        ->and(FarmHarvest::query()->count())->toBe(0);
});

test('completed harvests sum against the estimate and cancelled harvests do not', function () {
    $farm = Farm::factory()->create(['crop_type' => CropType::Coffee]);
    $production = FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'expected_quantity' => 1200,
        'unit' => 'kg',
        'production_period' => '2026',
    ]);

    foreach ([300, 350, 300] as $quantity) {
        FarmHarvest::factory()->create([
            'farm_id' => $farm->id,
            'production_id' => $production->id,
            'crop_type' => CropType::Coffee,
            'quantity' => $quantity,
            'unit' => 'kg',
            'status' => HarvestStatus::Completed,
        ]);
    }

    FarmHarvest::factory()->create([
        'farm_id' => $farm->id,
        'production_id' => $production->id,
        'quantity' => 80,
        'unit' => 'kg',
        'status' => HarvestStatus::Cancelled,
    ]);

    $production->loadSum(['harvests as harvested_quantity' => function ($query): void {
        $query->where('status', HarvestStatus::Completed)
            ->whereColumn('farm_harvests.unit', 'farm_productions.unit');
    }], 'quantity');

    $presented = $production->present();

    expect($presented['harvested_quantity'])->toBe(950.0)
        ->and($presented['expected_label'])->toBe('1,200 kg')
        ->and($presented['harvested_label'])->toBe('950 kg')
        ->and($presented['remaining_label'])->toBe('250 kg')
        ->and($presented['exceeds'])->toBeFalse()
        ->and((float) $production->expected_quantity)->toBe(1200.0);
});

test('actual harvest may exceed the estimate without changing it', function () {
    $farm = Farm::factory()->create();
    $production = FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'expected_quantity' => 100,
        'unit' => 'kg',
    ]);

    FarmHarvest::factory()->create([
        'farm_id' => $farm->id,
        'production_id' => $production->id,
        'quantity' => 150,
        'unit' => 'kg',
        'status' => HarvestStatus::Completed,
    ]);

    $production->refresh();
    $presented = $production->present();

    expect((float) $production->expected_quantity)->toBe(100.0)
        ->and($presented['harvested_quantity'])->toBe(150.0)
        ->and($presented['exceeds'])->toBeTrue()
        ->and($presented['message'])->toBe('Actual harvest exceeds expected production.')
        ->and($presented['remaining_label'])->toBe('Over by 50 kg');
});

test('a completed harvest stays in history and cannot be cancelled or deleted', function () {
    $harvest = FarmHarvest::factory()->create([
        'status' => HarvestStatus::Completed,
        'quantity' => 300,
        'quality_grade' => 'Grade A',
    ]);
    $user = productionOperationsUser();

    $this->actingAs($user)
        ->put(route('harvest.update', $harvest), [
            'harvest_date' => '2026-10-07',
            'quantity' => 300,
            'unit' => 'kg',
            'quality_grade' => 'Grade A',
            'status' => HarvestStatus::Cancelled->value,
            'notes' => null,
        ])
        ->assertSessionHasErrors('status');

    $this->actingAs($user)
        ->delete(route('harvest.show', $harvest))
        ->assertMethodNotAllowed();

    $harvest->refresh();

    expect($harvest->status)->toBe(HarvestStatus::Completed)
        ->and(FarmHarvest::query()->count())->toBe(1);

    $planned = FarmHarvest::factory()->create([
        'farm_id' => $harvest->farm_id,
        'status' => HarvestStatus::Planned,
        'quantity' => 40,
    ]);

    $this->actingAs($user)
        ->put(route('harvest.update', $planned), [
            'harvest_date' => '2026-10-08',
            'quantity' => 40,
            'unit' => 'kg',
            'quality_grade' => null,
            'status' => HarvestStatus::Cancelled->value,
            'notes' => null,
        ])
        ->assertRedirect();

    expect($planned->refresh()->status)->toBe(HarvestStatus::Cancelled);
});

test('editing a production estimate does not rewrite harvest history', function () {
    $user = productionOperationsUser();
    $farm = Farm::factory()->create(['crop_type' => CropType::Coffee]);
    $production = FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'expected_quantity' => 1200,
        'unit' => 'kg',
        'production_period' => '2026',
    ]);
    $harvest = FarmHarvest::factory()->create([
        'farm_id' => $farm->id,
        'production_id' => $production->id,
        'quantity' => 300,
        'unit' => 'kg',
        'created_by' => $user->id,
    ]);
    $createdAt = $harvest->created_at?->toDateTimeString();

    $this->actingAs($user)
        ->put(route('production.update', $production), [
            'crop_type' => CropType::Coffee->value,
            'production_period' => '2026 Coffee Season',
            'expected_quantity' => 1100,
            'unit' => 'kg',
            'notes' => 'Revised estimate',
            'status' => ProductionStatus::Active->value,
        ])
        ->assertRedirect(route('production.show', $production));

    $harvest->refresh();

    expect((float) $production->refresh()->expected_quantity)->toBe(1100.0)
        ->and((float) $harvest->quantity)->toBe(300.0)
        ->and($harvest->created_by)->toBe($user->id)
        ->and($harvest->created_at?->toDateTimeString())->toBe($createdAt);
});

test('farm and farmer profiles and the dashboard use stored production totals', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'crop_type' => CropType::Cacao,
    ]);
    $production = FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'expected_quantity' => 1200,
        'unit' => 'kg',
        'production_period' => '2026',
        'status' => ProductionStatus::Active,
    ]);

    foreach ([300, 350, 300] as $index => $quantity) {
        FarmHarvest::factory()->create([
            'farm_id' => $farm->id,
            'production_id' => $production->id,
            'crop_type' => CropType::Coffee,
            'quantity' => $quantity,
            'unit' => 'kg',
            'quality_grade' => 'Grade A',
            'status' => HarvestStatus::Completed,
            'harvest_date' => '2026-10-0'.($index + 1),
        ]);
    }

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farms/show')
            ->where('farm.production_summary.expected_label', '1,200 kg')
            ->where('farm.production_summary.actual_label', '950 kg')
            ->where('farm.production_summary.remaining_label', '250 kg')
            ->where('farm.productions.0.crop_label', 'Coffee')
            ->where('farm.productions.0.harvested_label', '950 kg')
            ->has('farm.harvests', 3)
            ->where('farm.harvests.0.quality_grade', 'Grade A')
            ->where('farm.declared_area_hectares', (float) $farm->declared_area_hectares));

    $this->actingAs($user)
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farmers/show')
            ->where('farmer.production_summary.expected_label', '1,200 kg')
            ->where('farmer.production_summary.actual_label', '950 kg')
            ->where('farmer.production_summary.harvesting_farms', 1));

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('harvest_summary.expected_label', '1,200 kg')
            ->where('harvest_summary.actual_label', '950 kg')
            ->where('harvest_summary.harvesting_farms', 1)
            ->has('recent_harvests', 3));

    $this->actingAs($user)
        ->get(route('production.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('production/index')
            ->where('summary.total_expected', '1,200 kg')
            ->where('summary.farms_in_production', 1)
            ->where('summary.active_crops', 1)
            ->where('productions.data.0.harvested_label', '950 kg')
            ->where('productions.data.0.remaining_label', '250 kg'));
});

test('production and harvest lists filter by the registry and harvest status', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'farmer_id' => 'SF-000-000-000-001',
    ]);
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_name' => 'North Coffee Farm',
        'farm_id' => 'FARM-000001',
        'crop_type' => CropType::Coffee,
    ]);
    $other = Farm::factory()->create(['farm_name' => 'Riverside Farm']);
    FarmProduction::factory()->create([
        'farm_id' => $farm->id,
        'production_period' => '2026',
        'status' => ProductionStatus::Active,
    ]);
    FarmProduction::factory()->create([
        'farm_id' => $other->id,
        'production_period' => '2025',
        'status' => ProductionStatus::Planned,
    ]);
    FarmHarvest::factory()->create([
        'farm_id' => $farm->id,
        'status' => HarvestStatus::Completed,
        'quality_grade' => 'Grade A',
        'harvest_date' => '2026-10-07',
    ]);
    FarmHarvest::factory()->create([
        'farm_id' => $other->id,
        'status' => HarvestStatus::Planned,
        'quality_grade' => 'Grade C',
        'harvest_date' => '2026-01-02',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('production.index', ['search' => 'North Coffee']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('productions.data', 1)
            ->where('productions.data.0.farm.farm_name', 'North Coffee Farm'));

    $this->actingAs($user)
        ->get(route('harvest.index', [
            'search' => 'SF-000-000-000-001',
            'status' => HarvestStatus::Completed->value,
            'quality' => 'Grade A',
            'from' => '2026-10-01',
            'to' => '2026-10-31',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('harvests.data', 1)
            ->where('harvests.data.0.farm.farm_name', 'North Coffee Farm'));
});

test('field verifiers can view production and harvest records but cannot change them', function () {
    $production = FarmProduction::factory()->create();
    $harvest = FarmHarvest::factory()->create();
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);

    $this->actingAs($verifier)
        ->get(route('production.index'))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('production.show', $production))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('harvest.index'))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('harvest.show', $harvest))
        ->assertOk();

    $this->actingAs($verifier)
        ->post(route('production.store'), productionPayload($production->farm))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->post(route('harvest.store'), harvestPayload($harvest->farm))
        ->assertForbidden();
});

test('farmer accounts cannot open production or harvest management', function () {
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);

    $this->actingAs($farmer)
        ->get(route('production.index'))
        ->assertForbidden();

    $this->actingAs($farmer)
        ->get(route('harvest.index'))
        ->assertForbidden();
});
