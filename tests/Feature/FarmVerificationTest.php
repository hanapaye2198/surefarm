<?php

use App\CropType;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmBoundary;
use App\Models\Farmer;
use App\Models\FarmVerification;
use App\Models\User;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

test('a pending farm appears in the verification list', function () {
    $farm = farmReadyToVerify();

    $this->actingAs(fieldVerifier())
        ->get(route('farm-verification.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('farm-verification/index')
            ->where('farms.data.0.farm_id', 'FARM-000001')
            ->where('farms.data.0.farm_name', 'North Coffee Farm')
            ->where('farms.data.0.farmer_name', 'Juan Dela Cruz')
            ->where('farms.data.0.crop_label', 'Coffee')
            ->where('farms.data.0.declared_area', '2.84 ha')
            ->where('farms.data.0.measured_area', '2.79 ha')
            ->where('farms.data.0.variance', '1.76%')
            ->where('farms.data.0.verification_status', 'pending')
            ->where('summary.pending', 1));

    expect($farm->verification_status)->toBe(FarmVerificationStatus::Pending);
});

test('verification search stays on the server', function () {
    farmReadyToVerify();
    Farm::factory()->create([
        'farm_name' => 'South Plot',
        'farm_id' => 'FARM-000002',
    ]);

    $this->actingAs(fieldVerifier())
        ->get(route('farm-verification.index', ['search' => 'North Coffee']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('farms.data', 1)
            ->where('farms.data.0.farm_id', 'FARM-000001'));
});

test('verification cannot start without a boundary', function () {
    $farm = Farm::factory()->create([
        'declared_area_hectares' => 2.84,
        'verification_status' => FarmVerificationStatus::Pending,
    ]);

    $this->actingAs(fieldVerifier())
        ->from(route('farm-verification.show', $farm))
        ->post(route('farm-verification.store', $farm))
        ->assertRedirect(route('farm-verification.show', $farm))
        ->assertSessionHasErrors([
            'verification' => 'Farm boundary is required before verification.',
        ]);

    $farm->refresh();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::Pending)
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and(FarmVerification::query()->count())->toBe(0);
});

test('starting verification moves a mapped farm to in progress', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)
        ->post(route('farm-verification.store', $farm))
        ->assertRedirect(route('farm-verification.show', $farm));

    $farm->refresh();
    $verification = $farm->verifications()->first();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::InProgress)
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verified_area_hectares)->toBeNull()
        ->and($farm->verifications)->toHaveCount(1)
        ->and($verification->previous_status)->toBe(FarmVerificationStatus::Pending)
        ->and($verification->declared_area_hectares)->toBe('2.84')
        ->and($verification->measured_area_hectares)->toBe('2.79')
        ->and($verification->difference_hectares)->toBe('0.05')
        ->and($verification->variance_percentage)->toBe('1.76')
        ->and($verification->result)->toBeNull()
        ->and($verification->verification_reference)->toBe(
            'VER-'.str_pad((string) $verification->id, 6, '0', STR_PAD_LEFT),
        );
});

test('approval stores the measured area without changing the declared area', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)
        ->post(route('farm-verification.store', $farm))
        ->assertRedirect();

    $this->actingAs($verifier)
        ->put(route('farm-verification.update', $farm), [
            'result' => 'verified',
            'remarks' => 'Boundary matches the declared farm.',
        ])
        ->assertRedirect(route('farm-verification.show', $farm));

    $farm->refresh();
    $verification = $farm->verifications()->first();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verified_area_hectares)->toBe('2.79')
        ->and($verification->result)->toBe(FarmVerificationResult::Verified)
        ->and($verification->difference_hectares)->toBe('0.05')
        ->and($verification->variance_percentage)->toBe('1.76')
        ->and($verification->verified_by)->toBe($verifier->id)
        ->and($verification->remarks)->toBe('Boundary matches the declared farm.')
        ->and($verification->verified_at)->not->toBeNull()
        ->and($farm->verifications)->toHaveCount(1);

    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.declared_area_hectares', 2.84)
            ->where('farm.measured_area', '2.79 ha')
            ->where('farm.verified_area', '2.79 ha')
            ->where('farm.difference', '0.05 ha')
            ->where('farm.variance', '1.76%')
            ->where('farm.verification_status', 'verified')
            ->has('farm.verifications', 1)
            ->where('farm.verifications.0.reference', $verification->verification_reference)
            ->where('farm.verifications.0.result', 'verified')
            ->where('farm.verifications.0.verified_by', 'John Doe'));

    $this->actingAs($verifier)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.verified_farms', 1)
            ->where('summary.pending_verification', 0)
            ->where('area_summary.total_verified_hectares', 2.79)
            ->where('area_summary.total_declared_hectares', 2.84));
});

test('a failed verification does not set verified area', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)->post(route('farm-verification.store', $farm));
    $this->actingAs($verifier)->put(route('farm-verification.update', $farm), [
        'result' => 'failed',
        'remarks' => 'The boundary does not match the farm.',
    ])->assertRedirect();

    $farm->refresh();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::Failed)
        ->and($farm->verified_area_hectares)->toBeNull()
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verifications()->first()->result)->toBe(FarmVerificationResult::Failed);
});

test('needs review does not set verified area', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)->post(route('farm-verification.store', $farm));
    $this->actingAs($verifier)->put(route('farm-verification.update', $farm), [
        'result' => 'needs_review',
        'remarks' => 'Check the north corner.',
    ])->assertRedirect();

    $farm->refresh();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::NeedsReview)
        ->and($farm->verified_area_hectares)->toBeNull()
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($farm->verifications()->first()->result)->toBe(FarmVerificationResult::NeedsReview);
});

test('a later verification keeps the earlier history and verified area', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)->post(route('farm-verification.store', $farm));
    $this->actingAs($verifier)->put(route('farm-verification.update', $farm), [
        'result' => 'verified',
        'remarks' => 'First review.',
    ]);
    $this->actingAs($verifier)->post(route('farm-verification.store', $farm));
    $this->actingAs($verifier)->put(route('farm-verification.update', $farm), [
        'result' => 'failed',
        'remarks' => 'Second review.',
    ]);

    $farm->refresh();
    $records = FarmVerification::query()->where('farm_id', $farm->id)->orderBy('id')->get();

    expect($records)->toHaveCount(2)
        ->and($records[0]->result)->toBe(FarmVerificationResult::Verified)
        ->and($records[1]->result)->toBe(FarmVerificationResult::Failed)
        ->and($records[0]->verification_reference)->not->toBe($records[1]->verification_reference)
        ->and($farm->verification_status)->toBe(FarmVerificationStatus::Failed)
        ->and($farm->verified_area_hectares)->toBe('2.79')
        ->and($farm->declared_area_hectares)->toBe('2.84');
});

test('verification references are unique', function () {
    $first = farmReadyToVerify();
    $second = Farm::factory()->create([
        'farm_id' => 'FARM-000002',
        'declared_area_hectares' => 1.5,
    ]);
    FarmBoundary::factory()->create([
        'farm_id' => $second->id,
        'gps_measured_area_hectares' => 1.23,
    ]);
    $verifier = fieldVerifier();

    $this->actingAs($verifier)->post(route('farm-verification.store', $first));
    $this->actingAs($verifier)->post(route('farm-verification.store', $second));

    $references = FarmVerification::query()->pluck('verification_reference');

    expect($references)->toHaveCount(2)
        ->and($references->unique())->toHaveCount(2)
        ->and($references->every(fn (string $reference): bool => preg_match('/^VER-\d{6}$/', $reference) === 1))->toBeTrue();
});

test('operations staff cannot approve a verification', function () {
    $farm = farmReadyToVerify();

    $this->actingAs(User::factory()->create(['role' => UserRole::Operations]))
        ->put(route('farm-verification.update', $farm), [
            'result' => 'verified',
        ])
        ->assertForbidden();

    expect($farm->refresh()->verification_status)->toBe(FarmVerificationStatus::Pending);
});

test('a farmer cannot verify their own farm', function () {
    $farm = farmReadyToVerify();
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);

    $this->actingAs($farmer)
        ->post(route('farm-verification.store', $farm))
        ->assertForbidden();

    $this->actingAs($farmer)
        ->put(route('farm-verification.update', $farm), [
            'result' => 'verified',
            'remarks' => 'I approve my own farm.',
        ])
        ->assertForbidden();

    expect($farm->refresh()->verification_status)->toBe(FarmVerificationStatus::Pending)
        ->and($farm->verified_area_hectares)->toBeNull()
        ->and(FarmVerification::query()->count())->toBe(0);
});

test('approval rolls back when saving the farm fails', function () {
    $farm = farmReadyToVerify();
    $verifier = fieldVerifier();

    $this->actingAs($verifier)->post(route('farm-verification.store', $farm));

    Farm::updating(function (): void {
        throw new RuntimeException('Verification stopped.');
    });

    try {
        $this->actingAs($verifier)
            ->from(route('farm-verification.show', $farm))
            ->put(route('farm-verification.update', $farm), [
                'result' => 'verified',
                'remarks' => 'Approve the boundary.',
            ])
            ->assertRedirect(route('farm-verification.show', $farm))
            ->assertSessionHasErrors('verification');
    } finally {
        Farm::getEventDispatcher()->forget('eloquent.updating: '.Farm::class);
    }

    $farm->refresh();
    $verification = $farm->verifications()->first();

    expect($farm->verification_status)->toBe(FarmVerificationStatus::InProgress)
        ->and($farm->verified_area_hectares)->toBeNull()
        ->and($farm->declared_area_hectares)->toBe('2.84')
        ->and($verification->result)->toBeNull();
});

function farmReadyToVerify(): Farm
{
    $farmer = Farmer::factory()->create([
        'first_name' => 'Juan',
        'middle_name' => 'Dela',
        'last_name' => 'Cruz',
    ]);

    $farm = Farm::factory()->create([
        'farmer_id' => $farmer->id,
        'farm_id' => 'FARM-000001',
        'farm_name' => 'North Coffee Farm',
        'crop_type' => CropType::Coffee,
        'declared_area_hectares' => 2.84,
        'province' => 'Bukidnon',
        'municipality' => 'Malaybalay',
        'verification_status' => FarmVerificationStatus::Pending,
    ]);

    FarmBoundary::factory()->create([
        'farm_id' => $farm->id,
        'gps_measured_area_hectares' => 2.79,
    ]);

    return $farm;
}

function fieldVerifier(): User
{
    return User::factory()->create([
        'role' => UserRole::FieldVerifier,
        'name' => 'John Doe',
    ]);
}
