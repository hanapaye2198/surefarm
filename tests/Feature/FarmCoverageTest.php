<?php

use App\FarmVerificationStatus;
use App\FinancingType;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\User;
use App\ProductionStatus;
use App\UserRole;
use Inertia\Testing\AssertableInertia as Assert;

function coverageOperationsUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

test('crop insurance and financing are stored on each farm', function () {
    $farmer = Farmer::factory()->create();
    $first = Farm::factory()->for($farmer)->create([
        'farm_name' => 'North Coffee Farm',
        'declared_area_hectares' => 2.84,
        'verified_area_hectares' => 28.09,
        'verification_status' => FarmVerificationStatus::Verified,
        'financing_support_amount' => 8000,
    ]);
    $second = Farm::factory()->for($farmer)->create([
        'farm_name' => 'Upper Kadingilan Farm',
        'declared_area_hectares' => 1.75,
    ]);
    $production = FarmProduction::factory()->for($first)->create([
        'expected_quantity' => 1200,
        'status' => ProductionStatus::Active,
    ]);

    $user = coverageOperationsUser();

    $this->actingAs($user)
        ->post(route('farms.insurance.store', $first), [
            'covered' => '1',
            'amount' => '50000',
            'term_months' => '12',
        ])
        ->assertRedirect(route('farms.show', ['farm' => $first, 'tab' => 'insurance']));

    $this->actingAs($user)
        ->post(route('farms.financing.store', $first), [
            'amount' => '100000',
            'date_granted' => '2026-06-15',
            'loan_balance' => '65000',
            'financing_type' => FinancingType::Govt->value,
        ])
        ->assertRedirect(route('farms.show', ['farm' => $first, 'tab' => 'financing']));

    $this->actingAs($user)
        ->post(route('farms.insurance.store', $second), [
            'covered' => '0',
            'amount' => '999',
            'term_months' => '6',
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('farms.financing.store', $second), [
            'amount' => '75000',
            'date_granted' => '2026-07-01',
            'loan_balance' => '40000',
            'financing_type' => FinancingType::Mm->value,
        ])
        ->assertRedirect();

    $firstInsurance = FarmInsurance::query()->where('farm_id', $first->id)->firstOrFail();
    $secondInsurance = FarmInsurance::query()->where('farm_id', $second->id)->firstOrFail();
    $firstFinancing = FarmFinancing::query()->where('farm_id', $first->id)->firstOrFail();
    $secondFinancing = FarmFinancing::query()->where('farm_id', $second->id)->firstOrFail();

    expect($firstInsurance->covered)->toBeTrue()
        ->and((float) $firstInsurance->amount)->toBe(50000.0)
        ->and((int) $firstInsurance->term_months)->toBe(12)
        ->and($secondInsurance->covered)->toBeFalse()
        ->and($secondInsurance->amount)->toBeNull()
        ->and($secondInsurance->term_months)->toBeNull()
        ->and((float) $firstFinancing->amount)->toBe(100000.0)
        ->and($firstFinancing->date_granted->toDateString())->toBe('2026-06-15')
        ->and((float) $firstFinancing->loan_balance)->toBe(65000.0)
        ->and($firstFinancing->financing_type)->toBe(FinancingType::Govt)
        ->and($secondFinancing->financing_type)->toBe(FinancingType::Mm);

    $first->refresh();
    $production->refresh();

    expect((float) $first->declared_area_hectares)->toBe(2.84)
        ->and((float) $first->verified_area_hectares)->toBe(28.09)
        ->and($first->verification_status)->toBe(FarmVerificationStatus::Verified)
        ->and((float) $first->financing_support_amount)->toBe(8000.0)
        ->and((float) $production->expected_quantity)->toBe(1200.0);

    $this->actingAs($user)
        ->get(route('farms.show', $first))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.insurances.0.covered_label', 'Yes')
            ->where('farm.insurances.0.amount_label', '₱50,000.00')
            ->where('farm.insurances.0.term_label', '12 months')
            ->where('farm.financings.0.amount_label', '₱100,000.00')
            ->where('farm.financings.0.date_granted', '06/15/2026')
            ->where('farm.financings.0.loan_balance_label', '₱65,000.00')
            ->where('farm.financings.0.financing_type_label', 'Govt')
            ->where('farm.reference.financing_support', '₱8,000.00'));

    $this->actingAs($user)
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farmer.farm_coverage.0.number_label', 'Farm 01')
            ->where('farmer.farm_coverage.0.insurances.0.covered_label', 'Yes')
            ->where('farmer.farm_coverage.0.financings.0.financing_type_label', 'Govt')
            ->where('farmer.farm_coverage.1.number_label', 'Farm 02')
            ->where('farmer.farm_coverage.1.insurances.0.covered_label', 'No')
            ->where('farmer.farm_coverage.1.financings.0.amount_label', '₱75,000.00')
            ->where('farmer.farm_coverage.1.financings.0.date_granted', '07/01/2026')
            ->where('farmer.farm_coverage.1.financings.0.loan_balance_label', '₱40,000.00')
            ->where('farmer.farm_coverage.1.financings.0.financing_type_label', 'MM'));
});

test('a farm can keep more than one insurance and financing record', function () {
    $farm = Farm::factory()->create();
    $user = coverageOperationsUser();

    $this->actingAs($user)->post(route('farms.insurance.store', $farm), [
        'covered' => '1',
        'amount' => '10000',
        'term_months' => '6',
    ])->assertRedirect();

    $this->actingAs($user)->post(route('farms.insurance.store', $farm), [
        'covered' => '1',
        'amount' => '20000',
        'term_months' => '12',
    ])->assertRedirect();

    $this->actingAs($user)->post(route('farms.financing.store', $farm), [
        'amount' => '1000',
        'date_granted' => '2026-01-01',
        'loan_balance' => '0',
        'financing_type' => 'mm',
    ])->assertRedirect();

    $this->actingAs($user)->post(route('farms.financing.store', $farm), [
        'amount' => '2000',
        'date_granted' => '2026-08-01',
        'loan_balance' => '500',
        'financing_type' => 'govt',
    ])->assertRedirect();

    expect(FarmInsurance::query()->where('farm_id', $farm->id)->count())->toBe(2)
        ->and(FarmFinancing::query()->where('farm_id', $farm->id)->count())->toBe(2);

    $this->actingAs($user)
        ->get(route('farms.show', $farm))
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.financings.0.date_granted', '08/01/2026')
            ->where('farm.insurances', fn ($records) => count($records) === 2));
});

test('insurance and financing reject incomplete or invalid values', function () {
    $farm = Farm::factory()->create();
    $user = coverageOperationsUser();

    $this->actingAs($user)
        ->post(route('farms.insurance.store', $farm), [
            'covered' => '1',
            'amount' => '',
            'term_months' => '',
        ])
        ->assertSessionHasErrors(['amount', 'term_months']);

    $this->actingAs($user)
        ->post(route('farms.financing.store', $farm), [
            'amount' => '-10',
            'date_granted' => '',
            'loan_balance' => '-1',
            'financing_type' => 'bank',
        ])
        ->assertSessionHasErrors(['amount', 'date_granted', 'loan_balance', 'financing_type']);

    expect(FarmInsurance::query()->count())->toBe(0)
        ->and(FarmFinancing::query()->count())->toBe(0);
});

test('editing coverage stays on the same farm', function () {
    $farm = Farm::factory()->create();
    $other = Farm::factory()->create();
    $insurance = FarmInsurance::factory()->for($farm)->create();
    $financing = FarmFinancing::factory()->for($farm)->create();
    $user = coverageOperationsUser();

    $this->actingAs($user)
        ->put(route('farms.insurance.update', [$farm, $insurance]), [
            'covered' => '0',
        ])
        ->assertRedirect(route('farms.show', ['farm' => $farm, 'tab' => 'insurance']));

    $this->actingAs($user)
        ->put(route('farms.financing.update', [$farm, $financing]), [
            'amount' => '90000',
            'date_granted' => '2026-06-15',
            'loan_balance' => '0',
            'financing_type' => 'mm',
        ])
        ->assertRedirect(route('farms.show', ['farm' => $farm, 'tab' => 'financing']));

    $insurance->refresh();
    $financing->refresh();

    expect($insurance->farm_id)->toBe($farm->id)
        ->and($insurance->covered)->toBeFalse()
        ->and($insurance->amount)->toBeNull()
        ->and($financing->farm_id)->toBe($farm->id)
        ->and((float) $financing->loan_balance)->toBe(0.0)
        ->and($financing->financing_type)->toBe(FinancingType::Mm);

    $this->actingAs($user)
        ->put(route('farms.insurance.update', [$other, $insurance]), [
            'covered' => '1',
            'amount' => '1',
            'term_months' => '1',
        ])
        ->assertNotFound();

    expect($insurance->refresh()->covered)->toBeFalse();
});

test('field verifiers can view coverage and cannot change it', function () {
    $farm = Farm::factory()->create();
    FarmInsurance::factory()->for($farm)->create();
    $verifier = User::factory()->create(['role' => UserRole::FieldVerifier]);
    $farmer = User::factory()->create(['role' => UserRole::Farmer]);

    $this->actingAs($verifier)
        ->get(route('farms.show', $farm))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('farm.can_manage_coverage', false)
            ->where('farm.insurances.0.covered_label', 'Yes'));

    $this->actingAs($verifier)
        ->post(route('farms.insurance.store', $farm), [
            'covered' => '1',
            'amount' => '1000',
            'term_months' => '12',
        ])
        ->assertForbidden();

    $this->actingAs($farmer)
        ->get(route('farms.show', $farm))
        ->assertForbidden();

    $this->actingAs($farmer)
        ->post(route('farms.financing.store', $farm), [
            'amount' => '1000',
            'date_granted' => '2026-06-15',
            'loan_balance' => '1000',
            'financing_type' => 'mm',
        ])
        ->assertForbidden();
});
