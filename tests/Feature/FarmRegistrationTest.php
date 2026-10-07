<?php

use App\CropType;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function farmPayload(array $overrides = []): array
{
    return [
        'farm_name' => 'North Farm',
        'crop_type' => CropType::Coffee->value,
        'declared_area_hectares' => '2.84',
        'purok_sitio' => 'Purok 1',
        'barangay' => 'Kadilingan',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
        'latitude' => '8.1575',
        'longitude' => '125.1278',
        'notes' => 'Sloping coffee plot',
        ...$overrides,
    ];
}

test('operations staff can register a farm under a farmer', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
    ]);

    $response = $this->actingAs(operationsUser())
        ->post(route('farmers.farms.store', $farmer), farmPayload());

    $farm = Farm::query()->first();

    expect($farm)->not->toBeNull()
        ->and($farm->farmer_id)->toBe($farmer->id)
        ->and($farm->farm_id)->toBe('FARM-000001')
        ->and($farm->farm_name)->toBe('North Farm')
        ->and($farm->crop_type)->toBe(CropType::Coffee)
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Pending)
        ->and($farm->status->value)->toBe('active')
        ->and($farm->latitude)->toBe('8.1575000')
        ->and($farm->longitude)->toBe('125.1278000');

    $response->assertRedirect(route('farms.show', $farm));
});

test('each farm receives a unique generated id', function () {
    $farmer = Farmer::factory()->create();
    $user = operationsUser();

    $this->actingAs($user)->post(route('farmers.farms.store', $farmer), farmPayload());
    $this->actingAs($user)->post(route('farmers.farms.store', $farmer), farmPayload([
        'farm_name' => 'South Farm',
        'declared_area_hectares' => '1.25',
    ]));

    $ids = Farm::query()->orderBy('id')->pluck('farm_id');

    expect($ids)->toHaveCount(2)
        ->and($ids[0])->toBe('FARM-000001')
        ->and($ids[1])->toBe('FARM-000002')
        ->and($ids[0])->not->toBe($ids[1]);
});

test('a farmer can have multiple farms', function () {
    $farmer = Farmer::factory()->create();
    $user = operationsUser();

    $this->actingAs($user)->post(route('farmers.farms.store', $farmer), farmPayload([
        'declared_area_hectares' => '2.84',
    ]));
    $this->actingAs($user)->post(route('farmers.farms.store', $farmer), farmPayload([
        'farm_name' => 'River Plot',
        'crop_type' => CropType::Cacao->value,
        'declared_area_hectares' => '1.10',
    ]));

    expect($farmer->farms()->count())->toBe(2)
        ->and($farmer->farms()->sum('declared_area_hectares'))->toEqual(3.94);
});

test('declared farm area is required', function () {
    $farmer = Farmer::factory()->create();

    $this->actingAs(operationsUser())
        ->post(route('farmers.farms.store', $farmer), farmPayload([
            'declared_area_hectares' => '',
        ]))
        ->assertSessionHasErrors([
            'declared_area_hectares' => 'Declared farm area is required.',
        ]);

    expect(Farm::query()->count())->toBe(0);
});

test('declared farm area must be greater than zero', function (string $area) {
    $farmer = Farmer::factory()->create();

    $this->actingAs(operationsUser())
        ->post(route('farmers.farms.store', $farmer), farmPayload([
            'declared_area_hectares' => $area,
        ]))
        ->assertSessionHasErrors([
            'declared_area_hectares' => 'Declared farm area must be greater than 0.',
        ]);
})->with([
    'zero' => '0',
    'negative' => '-1',
]);

test('invalid coordinates are rejected', function (string $field, string $value, string $message) {
    $farmer = Farmer::factory()->create();

    $this->actingAs(operationsUser())
        ->post(route('farmers.farms.store', $farmer), farmPayload([
            $field => $value,
        ]))
        ->assertSessionHasErrors([
            $field => $message,
        ]);
})->with([
    'latitude' => ['latitude', '91', 'Latitude must be between -90 and 90.'],
    'longitude' => ['longitude', '181', 'Longitude must be between -180 and 180.'],
]);

test('a posted verification status does not override pending', function () {
    $farmer = Farmer::factory()->create();

    $this->actingAs(operationsUser())
        ->post(route('farmers.farms.store', $farmer), farmPayload([
            'verification_status' => FarmVerificationStatus::Verified->value,
            'status' => 'inactive',
        ]));

    $farm = Farm::query()->first();

    expect($farm)
        ->verification_status->toBe(FarmVerificationStatus::Pending)
        ->status->value->toBe('active')
        ->declared_area_hectares->toBe('2.84')
        ->latitude->toBe('8.1575000')
        ->longitude->toBe('125.1278000');
});

test('the farm profile shows the farmer and declared area', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'middle_name' => null,
        'last_name' => 'Santos',
    ]);
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000001',
        'farm_name' => 'North Farm',
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);

    $this->actingAs(operationsUser())
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farms/show')
            ->where('farm.farm_id', 'FARM-000001')
            ->where('farm.farm_name', 'North Farm')
            ->where('farm.farmer.full_name', 'Maria Santos')
            ->where('farm.declared_area_hectares', 2.84)
            ->where('farm.measured_area', 'Not yet measured')
            ->where('farm.verified_area', 'Not yet verified')
            ->where('farm.difference', '—')
            ->where('farm.variance', '—')
            ->where('farm.boundary', null)
            ->where('farm.can_manage_boundary', true)
            ->where('farm.can_remove_boundary', false));
});

test('the farmer profile lists registered farms', function () {
    $farmer = Farmer::factory()->create();
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000004',
        'farm_name' => 'North Farm',
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Verified,
    ]);

    $this->actingAs(operationsUser())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.farm_summary.registered_farms', 1)
            ->where('farmer.farm_summary.declared_area_hectares', 2.84)
            ->where('farmer.farm_summary.verified_farms', 1)
            ->where('farmer.farms.0.farm_id', 'FARM-000004')
            ->where('farmer.farms.0.farm_name', 'North Farm'));
});

test('the farms list returns saved records', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Juan',
        'middle_name' => null,
        'last_name' => 'Cruz',
    ]);
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_name' => 'North Farm',
        'crop_type' => CropType::Coffee,
    ]);
    Farm::factory()->create([
        'farm_name' => 'Other Plot',
        'crop_type' => CropType::Corn,
    ]);

    $this->actingAs(operationsUser())
        ->get(route('farms.index', ['search' => 'North', 'verification_status' => 'pending']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farms/index')
            ->has('farms.data', 1)
            ->where('farms.data.0.farm_id', $farm->farm_id)
            ->where('farms.data.0.farmer_name', 'Juan Cruz')
            ->where('farms.data.0.crop_label', 'Coffee'));
});

test('dashboard farm counts come from the database', function () {
    $farmer = Farmer::factory()->create();
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.50,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'crop_type' => CropType::Cacao,
        'declared_area_hectares' => 10,
        'verification_status' => FarmVerificationStatus::Verified,
    ]);

    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.registered_farmers', 1)
            ->where('summary.registered_farms', 2)
            ->where('summary.total_coffee_farm_area_hectares', 2.5)
            ->where('summary.verified_farms', 1)
            ->where('summary.pending_verification', 1)
            ->where('area_summary.total_declared_hectares', 12.5)
            ->where('area_summary.coffee_hectares', 2.5)
            ->where('area_summary.other_crop_hectares', 10)
            ->has('locations', 0));
});

test('field verifiers can view a farm but cannot register one', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
    ]);
    $verifier = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($verifier)
        ->get(route('farms.show', $farm))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('farmers.farms.create', $farmer))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->post(route('farmers.farms.store', $farmer), farmPayload())
        ->assertForbidden();
});

test('farmer accounts cannot open farm management', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
    ]);
    $user = User::factory()->create([
        'role' => UserRole::Farmer,
    ]);

    $this->actingAs($user)->get(route('farms.index'))->assertForbidden();
    $this->actingAs($user)->get(route('farms.show', $farm))->assertForbidden();
    $this->actingAs($user)->get(route('farmers.farms.create', $farmer))->assertForbidden();
    $this->actingAs($user)
        ->post(route('farmers.farms.store', $farmer), farmPayload())
        ->assertForbidden();

    expect(Farm::query()->count())->toBe(1);
});
