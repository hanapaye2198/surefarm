<?php

use App\BankAccountStatus;
use App\Models\Farmer;
use App\Models\FarmerBankAccount;
use App\Models\User;
use App\UserRole;

function profileStaff(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function profileFarmerPayload(array $overrides = []): array
{
    return [
        'first_name' => 'Maria',
        'middle_name' => 'Cruz',
        'last_name' => 'Santos',
        'purok_sitio' => 'Purok 1',
        'barangay' => 'Kadilingan',
        'municipality' => 'Malaybalay',
        'province' => 'Bukidnon',
        'mobile_number' => '09171234567',
        'email' => 'maria.santos@example.com',
        'has_spouse' => false,
        ...$overrides,
    ];
}

test('registration stores a date of birth, government id, and linked bank account', function () {
    $this->actingAs(profileStaff())
        ->post(route('farmers.store'), profileFarmerPayload([
            'date_of_birth' => '1980-05-12',
            'government_id' => 'PH-ID-000124',
            'has_bank_account' => true,
            'bank_name' => 'LANDBANK',
            'account_number' => '998877665544',
            'account_name' => 'Maria Cruz Santos',
            'bank_account_status' => 'verified',
        ]))
        ->assertRedirect();

    $farmer = Farmer::query()->first();
    $account = $farmer?->bankAccount;

    expect($farmer?->date_of_birth?->toDateString())->toBe('1980-05-12')
        ->and($farmer?->government_id)->toBe('PH-ID-000124')
        ->and($account)->not->toBeNull()
        ->and($account->bank_name)->toBe('LANDBANK')
        ->and($account->account_number)->toBe('998877665544')
        ->and($account->account_name)->toBe('Maria Cruz Santos')
        ->and($account->status)->toBe(BankAccountStatus::Verified);

    $this->actingAs(profileStaff())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('farmer.date_of_birth', 'May 12, 1980')
            ->where('farmer.government_id', 'PH-ID-000124')
            ->where('farmer.address', 'Purok 1, Kadilingan, Malaybalay, Bukidnon')
            ->where('farmer.bank_account.bank_name', 'LANDBANK')
            ->where('farmer.bank_account.account_number', '•••• 5544')
            ->where('farmer.bank_account.account_name', 'Maria Cruz Santos')
            ->where('farmer.bank_account.status', 'verified')
            ->where('farmer.bank_account.status_label', 'Verified'))
        ->assertDontSee('998877665544');
});

test('a farmer profile can omit identity details and a bank account', function () {
    $this->actingAs(profileStaff())
        ->post(route('farmers.store'), profileFarmerPayload([
            'has_bank_account' => false,
            'account_number' => 'not-a-number',
        ]))
        ->assertRedirect();

    $farmer = Farmer::query()->first();

    expect($farmer?->date_of_birth)->toBeNull()
        ->and($farmer?->government_id)->toBeNull()
        ->and(FarmerBankAccount::query()->count())->toBe(0);

    $this->actingAs(profileStaff())
        ->get(route('farmers.show', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('farmer.date_of_birth', null)
            ->where('farmer.government_id', null)
            ->where('farmer.bank_account', null));
});

test('a date of birth must be a real past date', function (string $date, string $message) {
    $this->actingAs(profileStaff())
        ->post(route('farmers.store'), profileFarmerPayload([
            'date_of_birth' => $date,
        ]))
        ->assertSessionHasErrors([
            'date_of_birth' => $message,
        ]);

    expect(Farmer::query()->count())->toBe(0);
})->with([
    'not a date' => ['May 12', 'Enter a valid date of birth.'],
    'today' => [now()->toDateString(), 'Date of birth must be in the past.'],
    'before 1900' => ['1899-12-31', 'Enter a valid date of birth.'],
]);

test('linking a bank account requires the bank, number, and account name', function () {
    $this->actingAs(profileStaff())
        ->post(route('farmers.store'), profileFarmerPayload([
            'has_bank_account' => true,
            'account_number' => '12AB',
        ]))
        ->assertSessionHasErrors([
            'bank_name' => 'Bank name is required.',
            'account_number' => 'Account number can only contain digits, spaces, and dashes.',
            'account_name' => 'Account name is required.',
        ]);

    expect(FarmerBankAccount::query()->count())->toBe(0);
});

test('operations staff can add and remove a bank account on an existing farmer', function () {
    $farmer = Farmer::factory()->create([
        'first_name' => 'Maria',
        'middle_name' => 'Cruz',
        'last_name' => 'Santos',
    ]);
    $staff = profileStaff();

    $this->actingAs($staff)
        ->put(route('farmers.update', $farmer), [
            'date_of_birth' => '1980-05-12',
            'government_id' => 'PH-ID-000124',
            'has_bank_account' => true,
            'bank_name' => 'LANDBANK',
            'account_number' => '998877665544',
            'account_name' => 'Maria Cruz Santos',
            'bank_account_status' => 'verified',
        ])
        ->assertRedirect(route('farmers.show', $farmer));

    $farmer->refresh();

    expect($farmer->date_of_birth?->toDateString())->toBe('1980-05-12')
        ->and($farmer->government_id)->toBe('PH-ID-000124')
        ->and($farmer->bankAccount?->account_number)->toBe('998877665544');

    $this->actingAs($staff)
        ->get(route('farmers.edit', $farmer))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('farmers/edit')
            ->where('farmer.account_number', '998877665544'));

    $this->actingAs($staff)
        ->put(route('farmers.update', $farmer), [
            'date_of_birth' => '1980-05-12',
            'government_id' => 'PH-ID-000124',
            'has_bank_account' => false,
        ])
        ->assertRedirect(route('farmers.show', $farmer));

    expect($farmer->refresh()->bankAccount)->toBeNull()
        ->and($farmer->date_of_birth?->toDateString())->toBe('1980-05-12')
        ->and($farmer->government_id)->toBe('PH-ID-000124');
});

test('field verifiers can view a farmer profile but cannot change bank details', function () {
    $farmer = Farmer::factory()->create();
    $verifier = User::factory()->create([
        'role' => UserRole::FieldVerifier,
    ]);

    $this->actingAs($verifier)
        ->get(route('farmers.show', $farmer))
        ->assertOk();

    $this->actingAs($verifier)
        ->get(route('farmers.edit', $farmer))
        ->assertForbidden();

    $this->actingAs($verifier)
        ->put(route('farmers.update', $farmer), [
            'has_bank_account' => true,
            'bank_name' => 'LANDBANK',
            'account_number' => '998877665544',
            'account_name' => 'Maria Cruz Santos',
        ])
        ->assertForbidden();

    expect(FarmerBankAccount::query()->count())->toBe(0);
});
