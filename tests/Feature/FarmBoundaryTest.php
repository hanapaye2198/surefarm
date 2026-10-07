<?php

use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\User;
use App\Services\FarmBoundaryGeometry;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array{type: string, coordinates: list<list<array{0: float, 1: float}>>}
 */
function boundaryPolygon(float $size = 0.001): array
{
    return [
        'type' => 'Polygon',
        'coordinates' => [[
            [125.1278, 8.1575],
            [125.1278 + $size, 8.1575],
            [125.1278 + $size, 8.1575 + $size],
            [125.1278, 8.1575 + $size],
            [125.1278, 8.1575],
        ]],
    ];
}

test('guests cannot save a farm boundary', function () {
    $farm = Farm::factory()->create();

    $this->post(route('farms.boundary.store', $farm), [
        'boundary_geojson' => boundaryPolygon(),
    ])->assertRedirect(route('login'));
});

test('operations staff can save one boundary without changing declared area or verification', function () {
    $farmer = Farmer::factory()->create();
    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    $user = operationsUser();
    $polygon = boundaryPolygon();
    $expected = app(FarmBoundaryGeometry::class)->inspect($polygon);

    $this->actingAs($user)
        ->post(route('farms.boundary.store', $farm), [
            'boundary_geojson' => $polygon,
            'gps_measured_area_hectares' => 999,
            'verification_status' => FarmVerificationStatus::Verified->value,
            'declared_area_hectares' => 1,
        ])
        ->assertRedirect(route('farms.show', $farm));

    $farm->refresh();
    $boundary = $farm->boundary;

    expect($boundary)->not->toBeNull()
        ->and(FarmBoundary::query()->count())->toBe(1)
        ->and($boundary->farm_id)->toBe($farm->id)
        ->and($boundary->gps_measured_area_hectares)->toBe(number_format($expected['hectares'], 2, '.', ''))
        ->and($boundary->created_by)->toBe($user->id)
        ->and($boundary->updated_by)->toBe($user->id)
        ->and($boundary->captured_at)->not->toBeNull()
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Pending);

    $this->actingAs($user)
        ->post(route('farms.boundary.store', $farm), [
            'boundary_geojson' => boundaryPolygon(0.002),
        ])
        ->assertSessionHasErrors('boundary_geojson');

    expect(FarmBoundary::query()->count())->toBe(1);
});

test('an existing boundary can be replaced without creating a second record', function () {
    $farm = Farm::factory()->create([
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    $author = operationsUser();
    $editor = operationsUser();

    $this->actingAs($author)->post(route('farms.boundary.store', $farm), [
        'boundary_geojson' => boundaryPolygon(),
    ]);

    $capturedAt = $farm->boundary()->first()->captured_at;

    $this->actingAs($editor)
        ->put(route('farms.boundary.update', $farm), [
            'boundary_geojson' => boundaryPolygon(0.002),
        ])
        ->assertRedirect(route('farms.show', $farm));

    $farm->refresh();

    expect(FarmBoundary::query()->count())->toBe(1)
        ->and($farm->boundary->created_by)->toBe($author->id)
        ->and($farm->boundary->updated_by)->toBe($editor->id)
        ->and($farm->boundary->captured_at->equalTo($capturedAt))->toBeTrue()
        ->and((float) $farm->boundary->gps_measured_area_hectares)->toBeGreaterThan(1)
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Pending);
});

test('invalid boundaries are rejected', function (array $polygon, string $message) {
    $farm = Farm::factory()->create();

    $this->actingAs(operationsUser())
        ->post(route('farms.boundary.store', $farm), [
            'boundary_geojson' => $polygon,
        ])
        ->assertSessionHasErrors([
            'boundary_geojson' => $message,
        ]);

    expect(FarmBoundary::query()->count())->toBe(0);
})->with([
    'wrong type' => [[
        'type' => 'LineString',
        'coordinates' => [[125.1, 8.1], [125.2, 8.2]],
    ], 'The boundary must be a polygon.'],
    'missing ring' => [[
        'type' => 'Polygon',
    ], 'The boundary needs a coordinate ring.'],
    'too few points' => [[
        'type' => 'Polygon',
        'coordinates' => [[[125.1, 8.1], [125.2, 8.1], [125.1, 8.1]]],
    ], 'The boundary needs at least three points.'],
    'not closed' => [[
        'type' => 'Polygon',
        'coordinates' => [[[125.1, 8.1], [125.2, 8.1], [125.2, 8.2], [125.15, 8.15]]],
    ], 'Close the boundary by repeating the first point at the end.'],
    'invalid latitude' => [[
        'type' => 'Polygon',
        'coordinates' => [[[125.1, 91], [125.2, 91], [125.2, 8.2], [125.1, 91]]],
    ], 'Latitude must be between -90 and 90.'],
    'invalid longitude' => [[
        'type' => 'Polygon',
        'coordinates' => [[[181, 8.1], [125.2, 8.1], [125.2, 8.2], [181, 8.1]]],
    ], 'Longitude must be between -180 and 180.'],
]);

test('removing a boundary clears measured area only', function () {
    $farm = Farm::factory()->create([
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);
    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $this->actingAs(operationsUser())->post(route('farms.boundary.store', $farm), [
        'boundary_geojson' => boundaryPolygon(),
    ]);

    $this->actingAs(operationsUser())
        ->delete(route('farms.boundary.destroy', $farm))
        ->assertForbidden();

    expect($farm->boundary()->exists())->toBeTrue();

    $this->actingAs($admin)
        ->delete(route('farms.boundary.destroy', $farm))
        ->assertRedirect(route('farms.show', $farm));

    $farm->refresh();

    expect($farm->boundary)->toBeNull()
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Pending);
});

test('field verifiers can view a boundary but cannot change it', function () {
    $farm = Farm::factory()->create();
    $verifier = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($verifier)
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.boundary', null)
            ->where('farm.can_manage_boundary', false)
            ->where('farm.can_remove_boundary', false)
            ->where('farm.measured_area', 'Not yet measured'));

    $this->actingAs($verifier)
        ->post(route('farms.boundary.store', $farm), [
            'boundary_geojson' => boundaryPolygon(),
        ])
        ->assertForbidden();
});

test('farmers cannot manage farm boundaries', function () {
    $farm = Farm::factory()->create();
    $farmer = User::factory()->create([
        'role' => UserRole::Farmer,
    ]);

    $this->actingAs($farmer)
        ->get(route('farms.show', $farm))
        ->assertForbidden();

    $this->actingAs($farmer)
        ->post(route('farms.boundary.store', $farm), [
            'boundary_geojson' => boundaryPolygon(),
        ])
        ->assertForbidden();
});
