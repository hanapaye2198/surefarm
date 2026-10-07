<?php

use App\Contracts\FarmerIdGenerator;
use App\Models\Cooperative;
use App\Models\Farmer;
use App\Models\FarmerSpouse;
use App\Models\User;
use App\UserRole;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function operationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function farmerPayload(array $overrides = []): array
{
    return [
        'first_name' => 'Maria',
        'middle_name' => 'L',
        'last_name' => 'Santos',
        'purok_sitio' => 'Purok 1',
        'barangay' => 'Kadilingan',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
        'mobile_number' => '09171234567',
        'email' => 'maria@example.com',
        'has_spouse' => false,
        ...$overrides,
    ];
}

test('operations staff can register a farmer with a generated id', function () {
    $response = $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload());

    $farmer = Farmer::query()->first();

    expect($farmer)->not->toBeNull()
        ->and($farmer->farmer_id)->toBe(app(FarmerIdGenerator::class)->fromSequence($farmer->id))
        ->and($farmer->first_name)->toBe('Maria')
        ->and($farmer->status->value)->toBe('active')
        ->and($farmer->spouse)->toBeNull();

    $response->assertRedirect(route('farmers.show', $farmer));
});

test('each farmer receives a unique id', function () {
    $user = operationsUser();

    $this->actingAs($user)->post(route('farmers.store'), farmerPayload());
    $this->actingAs($user)->post(route('farmers.store'), farmerPayload([
        'first_name' => 'Pedro',
        'last_name' => 'Reyes',
        'mobile_number' => '09170000002',
        'email' => null,
    ]));

    $ids = Farmer::query()->orderBy('id')->pluck('farmer_id');

    expect($ids)->toHaveCount(2)
        ->and($ids[0])->not->toBe($ids[1])
        ->and($ids[0])->toBe('SF-000-000-000-001')
        ->and($ids[1])->toBe('SF-000-000-000-002');
});

test('required farmer fields are validated', function () {
    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), [])
        ->assertSessionHasErrors([
            'first_name' => 'First name is required.',
            'last_name' => 'Last name is required.',
            'purok_sitio' => 'Purok / sitio is required.',
            'barangay' => 'Barangay is required.',
            'municipality' => 'Municipality / city is required.',
            'province' => 'Province is required.',
            'mobile_number' => 'Mobile number is required.',
        ]);

    expect(Farmer::query()->count())->toBe(0);
});

test('an optional spouse is stored with the farmer', function () {
    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload([
            'has_spouse' => true,
            'spouse_first_name' => 'Juan',
            'spouse_middle_name' => '',
            'spouse_last_name' => 'Santos',
        ]));

    $farmer = Farmer::query()->first();

    expect($farmer?->spouse)->not->toBeNull()
        ->and($farmer->spouse->first_name)->toBe('Juan')
        ->and($farmer->spouse->middle_name)->toBeNull()
        ->and($farmer->spouse->last_name)->toBe('Santos');
});

test('a farmer can be registered without a spouse', function () {
    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload([
            'has_spouse' => false,
            'spouse_first_name' => 'Juan',
            'spouse_last_name' => 'Santos',
        ]));

    expect(FarmerSpouse::query()->count())->toBe(0);
});

test('a farmer photo is stored outside the farmers table', function () {
    Storage::fake();

    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload([
            'photo' => UploadedFile::fake()->image('maria.jpg'),
        ]));

    $farmer = Farmer::query()->first();

    expect($farmer?->photo_path)->not->toBeNull();
    Storage::disk(config('filesystems.default'))->assertExists($farmer->photo_path);
    expect($farmer->photo_path)->toStartWith('farmers/photos/');

    $this->get(route('farmers.photo', $farmer))->assertOk();
});

test('invalid and oversized photos are rejected', function (UploadedFile $photo, string $message) {
    Storage::fake();

    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload([
            'photo' => $photo,
        ]))
        ->assertSessionHasErrors([
            'photo' => $message,
        ]);

    expect(Farmer::query()->count())->toBe(0);
})->with([
    'wrong type' => [
        UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
        'Farmer photo must be a JPG or PNG image.',
    ],
    'too large' => [
        UploadedFile::fake()->image('large.jpg')->size(5121),
        'Farmer photo must be 5 MB or smaller.',
    ],
]);

test('the farmer profile shows the saved record', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'middle_name' => null,
        'last_name' => 'Santos',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
    ]);

    $this->actingAs(operationsUser())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farmers/show')
            ->where('farmer.full_name', 'Maria Santos')
            ->where('farmer.farmer_id', $farmer->farmer_id)
            ->where('farmer.farm_summary.registered_farms', 0)
            ->where('farmer.farm_summary.declared_area_hectares', 0)
            ->where('farmer.spouse', null));
});

test('the farmers list returns saved records', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'last_name' => 'Santos',
        'mobile_number' => '09170000001',
    ]);
    Farmer::factory()->create([
        'first_name' => 'Pedro',
        'last_name' => 'Reyes',
    ]);

    $this->actingAs(operationsUser())
        ->get(route('farmers.index', ['search' => '09170000001']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farmers/index')
            ->has('farmers.data', 1)
            ->where('farmers.data.0.farmer_id', $farmer->farmer_id)
            ->where('farmers.data.0.name', $farmer->fullName())
            ->where('farmers.data.0.farms_count', 0));
});

test('a cooperative can be attached when one exists', function () {
    $cooperative = Cooperative::factory()->create([
        'name' => 'Island Coffee Cooperative',
    ]);

    $this->actingAs(operationsUser())
        ->post(route('farmers.store'), farmerPayload([
            'cooperative_id' => $cooperative->id,
        ]));

    expect(Farmer::query()->first()?->cooperative?->name)->toBe('Island Coffee Cooperative');
});

test('field verifiers can view a farmer but cannot register one', function () {
    $farmer = Farmer::factory()->create();
    $verifier = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($verifier)
        ->get(route('farmers.show', $farmer))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('farmers.create'))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->post(route('farmers.store'), farmerPayload())
        ->assertForbidden();
});

test('farmer accounts cannot register farmers from the management form', function () {
    $user = User::factory()->create([
        'role' => UserRole::Farmer,
    ]);

    $this->actingAs($user)
        ->get(route('farmers.create'))
        ->assertForbidden();

    $this->actingAs($user)
        ->post(route('farmers.store'), farmerPayload())
        ->assertForbidden();

    expect(Farmer::query()->count())->toBe(0);
});
