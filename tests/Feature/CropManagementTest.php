<?php

use App\CropRecordStatus;
use App\CropType;
use App\Models\Farm;
use App\Models\FarmCrop;
use App\Models\Farmer;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function cropOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

function provinceCropUser(string $province): User
{
    $user = cropOperationsUser();
    $user->registryGrants()->where('kind', RegistryGrantKind::Platform)->update([
        'revoked_at' => now(),
    ]);
    RegistryGrant::factory()->create([
        'user_id' => $user->id,
        'kind' => RegistryGrantKind::Province,
        'province' => $province,
    ]);

    return $user->fresh();
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function cropPayload(Farm $farm, array $overrides = []): array
{
    return [
        'farm_id' => $farm->id,
        'crop_type' => $farm->crop_type->value,
        'variety' => 'Typica',
        'area_hectares' => '2.50',
        'planted_on' => '2026-05-01',
        'status' => CropRecordStatus::Active->value,
        'notes' => 'First planting',
        ...$overrides,
    ];
}

test('guests cannot open crop management', function () {
    $this->get(route('crops.index'))
        ->assertRedirect(route('login'));
});

test('an operations user can record a crop for a registered farm and see it after reload', function () {
    $farm = Farm::factory()->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
    ]);

    $this->actingAs(cropOperationsUser())
        ->post(route('crops.store'), cropPayload($farm))
        ->assertRedirect();

    $crop = FarmCrop::query()->firstOrFail();

    expect($crop->farm_id)->toBe($farm->id)
        ->and($crop->crop_type)->toBe(CropType::Coffee)
        ->and($crop->variety)->toBe('Typica')
        ->and((float) $crop->area_hectares)->toBe(2.5)
        ->and($crop->planted_on?->toDateString())->toBe('2026-05-01')
        ->and($crop->status)->toBe(CropRecordStatus::Active)
        ->and($crop->notes)->toBe('First planting');

    $farm->refresh();

    expect($farm->crop_type)->toBe(CropType::Coffee)
        ->and((float) $farm->declared_area_hectares)->toBe(2.84);

    $this->actingAs(cropOperationsUser())
        ->get(route('crops.show', $crop))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('crops/show')
            ->where('crop.variety', 'Typica')
            ->where('crop.area_label', '2.50 ha')
            ->where('crop.planted_on', '2026-05-01')
            ->where('crop.farm.farm_name', 'North Coffee Farm'));
});

test('crop records require a registered farm and the crop stored on that farm', function () {
    $farm = Farm::factory()->create(['crop_type' => CropType::Coffee]);
    $user = cropOperationsUser();

    $this->actingAs($user)
        ->from(route('crops.create'))
        ->post(route('crops.store'), cropPayload($farm, ['farm_id' => null]))
        ->assertRedirect(route('crops.create'))
        ->assertSessionHasErrors(['farm_id' => 'Farm is required.']);

    $this->actingAs($user)
        ->from(route('crops.create'))
        ->post(route('crops.store'), cropPayload($farm, ['crop_type' => CropType::Cacao->value]))
        ->assertRedirect(route('crops.create'))
        ->assertSessionHasErrors(['crop_type' => 'The selected crop must belong to this farm.']);

    $this->actingAs($user)
        ->from(route('crops.create'))
        ->post(route('crops.store'), cropPayload($farm, ['area_hectares' => '0']))
        ->assertRedirect(route('crops.create'))
        ->assertSessionHasErrors(['area_hectares' => 'Planted area must be greater than 0.']);

    $this->actingAs($user)
        ->from(route('crops.create'))
        ->post(route('crops.store'), cropPayload($farm, ['status' => 'growing']))
        ->assertRedirect(route('crops.create'))
        ->assertSessionHasErrors(['status' => 'Select a valid crop status.']);

    $this->actingAs($user)
        ->from(route('crops.create'))
        ->post(route('crops.store'), cropPayload($farm, ['planted_on' => 'not-a-date']))
        ->assertRedirect(route('crops.create'))
        ->assertSessionHasErrors(['planted_on' => 'Planted date must be a valid date.']);

    expect(FarmCrop::query()->count())->toBe(0);
});

test('editing a crop record persists the changes and keeps the same farm', function () {
    $farm = Farm::factory()->create([
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 4,
    ]);
    $otherFarm = Farm::factory()->create(['crop_type' => CropType::Cacao]);
    $crop = FarmCrop::factory()->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'variety' => 'Typica',
        'area_hectares' => 2.5,
        'status' => CropRecordStatus::Active,
    ]);

    $this->actingAs(cropOperationsUser())
        ->put(route('crops.update', $crop), [
            'farm_id' => $otherFarm->id,
            'crop_type' => CropType::Coffee->value,
            'variety' => 'Red Bourbon',
            'area_hectares' => '1.25',
            'planted_on' => '2026-05-02',
            'status' => CropRecordStatus::Completed->value,
            'notes' => 'Second pick',
        ])
        ->assertRedirect(route('crops.show', $crop));

    $crop->refresh();

    expect($crop->farm_id)->toBe($farm->id)
        ->and($crop->variety)->toBe('Red Bourbon')
        ->and((float) $crop->area_hectares)->toBe(1.25)
        ->and($crop->planted_on?->toDateString())->toBe('2026-05-02')
        ->and($crop->status)->toBe(CropRecordStatus::Completed)
        ->and($crop->notes)->toBe('Second pick');

    $farm->refresh();

    expect((float) $farm->declared_area_hectares)->toBe(4.0);

    $this->actingAs(cropOperationsUser())
        ->get(route('crops.show', $crop))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('crop.variety', 'Red Bourbon')
            ->where('crop.area_label', '1.25 ha')
            ->where('crop.status', 'completed')
            ->where('crop.farm.id', $farm->id));
});

test('crop management can search filter and paginate records', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Ana',
        'middle_name' => null,
        'last_name' => 'Reyes',
    ]);
    $farm = Farm::factory()->for($farmer)->create([
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
    ]);
    $match = FarmCrop::factory()->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'variety' => 'Typica',
        'status' => CropRecordStatus::Active,
    ]);
    FarmCrop::factory()->create([
        'crop_type' => CropType::Cacao,
        'variety' => 'Forastero',
        'status' => CropRecordStatus::Planned,
    ]);
    FarmCrop::factory()->count(10)->create([
        'farm_id' => $farm->id,
        'crop_type' => CropType::Coffee,
        'variety' => 'Other',
        'status' => CropRecordStatus::Completed,
    ]);

    $this->actingAs(cropOperationsUser())
        ->get(route('crops.index', [
            'search' => 'Typica',
            'farm' => $farm->id,
            'farmer' => $farmer->id,
            'crop' => CropType::Coffee->value,
            'status' => CropRecordStatus::Active->value,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('crops/index')
            ->has('crops.data', 1)
            ->where('crops.data.0.id', $match->id)
            ->where('crops.data.0.variety', 'Typica'));

    $this->actingAs(cropOperationsUser())
        ->get(route('crops.index', ['page' => 2]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('crops.data', 2));
});

test('field verifiers can view an assigned crop record but cannot change it', function () {
    $crop = FarmCrop::factory()->create();
    $hidden = FarmCrop::factory()->create();
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    assignFarmVerifier($verifier, $crop->farm);

    $this->actingAs($verifier)
        ->get(route('crops.show', $crop))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('can_edit', false));

    $this->actingAs($verifier)
        ->get(route('crops.show', $hidden))
        ->assertNotFound();

    $this->actingAs($verifier)
        ->post(route('crops.store'), cropPayload($crop->farm))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->put(route('crops.update', $crop), cropPayload($crop->farm))
        ->assertForbidden();
});

test('roles without operations access cannot record a crop', function (UserRole $role) {
    $farm = Farm::factory()->create();

    $this->actingAs(User::factory()->create(['role' => $role]))
        ->post(route('crops.store'), cropPayload($farm))
        ->assertForbidden();

    expect(FarmCrop::query()->count())->toBe(0);
})->with([
    'farmer' => UserRole::Farmer,
    'cooperative officer' => UserRole::CooperativeOfficer,
]);

test('a crop record outside the assigned province stays hidden', function () {
    $visibleFarm = Farm::factory()->create([
        'province' => 'Bukidnon',
        'crop_type' => CropType::Coffee,
    ]);
    $hiddenFarm = Farm::factory()->create([
        'province' => 'Davao del Sur',
        'crop_type' => CropType::Cacao,
    ]);
    $visible = FarmCrop::factory()->create([
        'farm_id' => $visibleFarm->id,
        'crop_type' => CropType::Coffee,
        'variety' => 'Typica',
    ]);
    $hidden = FarmCrop::factory()->create([
        'farm_id' => $hiddenFarm->id,
        'crop_type' => CropType::Cacao,
        'variety' => 'Forastero',
    ]);
    $user = provinceCropUser('Bukidnon');

    $this->actingAs($user)
        ->get(route('crops.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('crops.data', 1)
            ->where('crops.data.0.id', $visible->id));

    $this->actingAs($user)
        ->get(route('crops.show', $hidden))
        ->assertNotFound();

    $this->actingAs($user)
        ->post(route('crops.store'), cropPayload($hiddenFarm))
        ->assertNotFound();

    expect(FarmCrop::query()->where('farm_id', $hiddenFarm->id)->count())->toBe(1);
});
