<?php

use App\AccessEventAction;
use App\FinancingBalanceSource;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\AccessEvent;
use App\Models\Farm;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\Support\DecimalQuantity;
use App\UserRole;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function financeUser(): User
{
    return User::factory()->create([
        'role' => UserRole::Operations,
    ]);
}

function provinceFinanceUser(string $province): User
{
    $user = financeUser();
    $user->registryGrants()->where('kind', RegistryGrantKind::Platform)->update([
        'revoked_at' => now(),
    ]);
    RegistryGrant::factory()->create([
        'user_id' => $user->id,
        'kind' => RegistryGrantKind::Province,
        'province' => $province,
    ]);

    return $user;
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function financingApplication(Farm $farm, array $overrides = []): array
{
    return [
        'farm_id' => $farm->id,
        'purpose' => 'Harvest cash advance',
        'amount' => '100000.00',
        'currency' => 'PHP',
        'financing_type' => 'govt',
        'interest_method' => 'stated',
        'interest_amount' => '5000.00',
        'fee_amount' => '1000.00',
        'application_date' => now()->toDateString(),
        'repayment_frequency' => 'lump_sum',
        'due_date' => now()->addMonth()->toDateString(),
        'client_token' => (string) Str::uuid(),
        ...$overrides,
    ];
}

test('a financing application is reviewed, approved, and disbursed to the ledger', function () {
    $farm = Farm::factory()->create();
    $applicant = financeUser();
    $reviewer = financeUser();

    $this->actingAs($applicant)
        ->post(route('finance.store'), financingApplication($farm))
        ->assertRedirect();

    $financing = FarmFinancing::query()->firstOrFail();

    expect($financing->status)->toBe(FinancingStatus::Submitted)
        ->and($financing->balance_source)->toBe(FinancingBalanceSource::Ledger)
        ->and($financing->reference)->toStartWith('FIN-');

    $this->actingAs($applicant)
        ->post(route('finance.review', $financing))
        ->assertForbidden();

    $this->actingAs($applicant)
        ->post(route('finance.approve', $financing))
        ->assertForbidden();

    $this->actingAs($reviewer)
        ->post(route('finance.review', $financing))
        ->assertRedirect(route('finance.show', $financing));

    $this->actingAs($reviewer)
        ->post(route('finance.approve', $financing))
        ->assertRedirect(route('finance.show', $financing));

    $this->actingAs($applicant)
        ->post(route('finance.disburse', $financing), [
            'occurred_on' => now()->toDateString(),
            'disbursement_reference' => 'BANK-100',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertForbidden();

    $token = (string) Str::uuid();

    $this->actingAs($reviewer)
        ->post(route('finance.disburse', $financing), [
            'occurred_on' => now()->toDateString(),
            'disbursement_reference' => 'BANK-100',
            'client_token' => $token,
        ])
        ->assertRedirect(route('finance.show', $financing));

    $this->actingAs($reviewer)
        ->post(route('finance.disburse', $financing), [
            'occurred_on' => now()->toDateString(),
            'disbursement_reference' => 'BANK-100',
            'client_token' => $token,
        ])
        ->assertRedirect(route('finance.show', $financing));

    $financing->refresh();

    expect($financing->status)->toBe(FinancingStatus::Disbursed)
        ->and($financing->loan_balance)->toBe('100000.00')
        ->and(FinancingTransaction::query()->count())->toBe(3)
        ->and(FinancingTransaction::query()->where('type', FinancingTransactionType::Disbursement)->count())->toBe(1);

    $this->actingAs($reviewer)
        ->get(route('finance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('finance/index')
            ->where('summary.active_agreements', 1)
            ->where('summary.pending_applications', 0)
            ->where('summary.currencies.0.disbursed', '₱100,000.00')
            ->where('summary.currencies.0.outstanding_principal', '₱100,000.00')
            ->where('summary.currencies.0.outstanding_interest', '₱5,000.00')
            ->where('summary.currencies.0.outstanding_fees', '₱1,000.00')
            ->where('summary.currencies.0.repayments', '₱0.00'));
});

test('repayments allocate to principal interest and fees and cannot overpay', function () {
    [$financing, $user] = disbursedFinancing();

    $token = (string) Str::uuid();
    $payment = [
        'occurred_on' => now()->toDateString(),
        'amount' => '21000.00',
        'principal_amount' => '20000.00',
        'interest_amount' => '1000.00',
        'fee_amount' => '0.00',
        'payment_method' => 'bank transfer',
        'external_reference' => 'OR-10',
        'client_token' => $token,
    ];

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), $payment)
        ->assertRedirect(route('finance.show', $financing));

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), $payment)
        ->assertRedirect(route('finance.show', $financing));

    $financing->refresh();

    expect($financing->loan_balance)->toBe('80000.00')
        ->and(FinancingTransaction::query()->where('type', FinancingTransactionType::PrincipalRepayment)->count())->toBe(1)
        ->and(FinancingTransaction::query()->where('idempotency_key', $token)->count())->toBe(1);

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            ...$payment,
            'amount' => '90000.00',
            'principal_amount' => '90000.00',
            'interest_amount' => '0.00',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertSessionHasErrors('principal_amount');

    expect($financing->fresh()->loan_balance)->toBe('80000.00');

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            'occurred_on' => now()->toDateString(),
            'amount' => '60000.00',
            'principal_amount' => '60000.00',
            'interest_amount' => '0.00',
            'fee_amount' => '0.00',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            'occurred_on' => now()->toDateString(),
            'amount' => '50000.00',
            'principal_amount' => '50000.00',
            'interest_amount' => '0.00',
            'fee_amount' => '0.00',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertSessionHasErrors('principal_amount');

    expect($financing->fresh()->loan_balance)->toBe('20000.00');
});

test('a repayment reversal restores the balance and keeps the original transaction', function () {
    [$financing, $user] = disbursedFinancing();

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            'occurred_on' => now()->toDateString(),
            'amount' => '20000.00',
            'principal_amount' => '20000.00',
            'interest_amount' => '0.00',
            'fee_amount' => '0.00',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertRedirect();

    $payment = FinancingTransaction::query()->where('type', FinancingTransactionType::PrincipalRepayment)->firstOrFail();
    $originalAmount = $payment->amount;

    $this->actingAs($user)
        ->post(route('finance.transactions.reverse', [$financing, $payment]), [
            'occurred_on' => now()->toDateString(),
            'notes' => 'Posted to the wrong agreement.',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertRedirect(route('finance.show', $financing));

    $payment->refresh();

    expect($payment->amount)->toBe($originalAmount)
        ->and($financing->fresh()->loan_balance)->toBe('100000.00')
        ->and(FinancingTransaction::query()->where('type', FinancingTransactionType::Reversal)->count())->toBe(1)
        ->and(AccessEvent::query()->where('action', AccessEventAction::FinancingReversed)->exists())->toBeTrue();

    $this->actingAs($user)
        ->post(route('finance.transactions.reverse', [$financing, $payment]), [
            'occurred_on' => now()->toDateString(),
            'notes' => 'Try again.',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertSessionHasErrors('notes');

    expect(fn () => $payment->update(['amount' => '1.00']))->toThrow(RuntimeException::class);
    expect($payment->fresh()->amount)->toBe($originalAmount);
});

test('a stated farm grant is not treated as a ledger disbursement', function () {
    $farm = Farm::factory()->create();
    $user = financeUser();

    $this->actingAs($user)
        ->post(route('farms.financing.store', $farm), [
            'amount' => '50000',
            'date_granted' => now()->toDateString(),
            'loan_balance' => '40000',
            'financing_type' => 'mm',
        ])
        ->assertRedirect();

    $grant = FarmFinancing::query()->firstOrFail();

    expect($grant->balance_source)->toBe(FinancingBalanceSource::Snapshot)
        ->and(FinancingTransaction::query()->count())->toBe(0);

    [, $ledgerUser] = disbursedFinancing();

    $this->actingAs($ledgerUser)
        ->get(route('finance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.snapshot_count', 1)
            ->where('summary.currencies.0.disbursed', '₱100,000.00')
            ->where('summary.currencies.0.outstanding_principal', '₱100,000.00'));

    $this->actingAs($user)
        ->put(route('farms.financing.update', [$grant->farm, $grant]), [
            'amount' => '1',
            'date_granted' => now()->toDateString(),
            'loan_balance' => '1',
            'financing_type' => 'mm',
        ])
        ->assertRedirect();

    $ledger = FarmFinancing::query()->where('balance_source', FinancingBalanceSource::Ledger)->firstOrFail();

    $this->actingAs($ledgerUser)
        ->put(route('farms.financing.update', [$ledger->farm, $ledger]), [
            'amount' => '1',
            'date_granted' => now()->toDateString(),
            'loan_balance' => '1',
            'financing_type' => 'mm',
        ])
        ->assertSessionHasErrors('amount');

    expect($ledger->fresh()->amount)->toBe('100000.00');
});

test('finance records stay inside the user registry scope', function () {
    $inside = Farm::factory()->create(['province' => 'Bukidnon', 'farm_name' => 'Visible Farm']);
    $outside = Farm::factory()->create(['province' => 'Davao del Sur', 'farm_name' => 'Hidden Farm']);
    $manager = financeUser();
    $limited = provinceFinanceUser('Bukidnon');

    $this->actingAs($manager)->post(route('finance.store'), financingApplication($inside, [
        'amount' => '1000.00',
        'interest_method' => 'none',
        'interest_amount' => '0',
        'fee_amount' => '0',
    ]))->assertRedirect();

    $this->actingAs($manager)->post(route('finance.store'), financingApplication($outside, [
        'amount' => '2000.00',
        'interest_method' => 'none',
        'interest_amount' => '0',
        'fee_amount' => '0',
    ]))->assertRedirect();

    $hidden = FarmFinancing::query()->where('farm_id', $outside->id)->firstOrFail();

    $this->actingAs($limited)
        ->get(route('finance.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('financings.total', 1)
            ->where('financings.data.0.farm_name', 'Visible Farm'));

    $this->actingAs($limited)
        ->get(route('finance.show', $hidden))
        ->assertNotFound();

    $this->actingAs(User::factory()->create(['role' => UserRole::Farmer]))
        ->get(route('finance.index'))
        ->assertForbidden();

    $this->actingAs(User::factory()->create(['role' => UserRole::FieldVerifier]))
        ->get(route('finance.index'))
        ->assertForbidden();
});

test('financing export matches the filter and is audited', function () {
    $farm = Farm::factory()->create(['province' => 'Bukidnon']);
    $other = Farm::factory()->create(['province' => 'Davao del Sur']);
    $user = financeUser();

    $this->actingAs($user)->post(route('finance.store'), financingApplication($farm))->assertRedirect();
    $this->actingAs($user)->post(route('finance.store'), financingApplication($other))->assertRedirect();

    $visible = FarmFinancing::query()->where('farm_id', $farm->id)->firstOrFail();
    $hidden = FarmFinancing::query()->where('farm_id', $other->id)->firstOrFail();

    $response = $this->actingAs($user)
        ->get(route('finance.export', ['province' => 'Bukidnon']));

    $response->assertOk();
    $content = $response->streamedContent();

    expect($content)->toContain($visible->reference)
        ->and($content)->not->toContain($hidden->reference)
        ->and(AccessEvent::query()->where('action', AccessEventAction::FinancingExported)->count())->toBe(1);
});

test('financing documents are stored privately and hidden outside the registry', function () {
    Storage::fake('local');
    [$financing, $user] = disbursedFinancing();
    $outsider = provinceFinanceUser('Bukidnon');

    $this->actingAs($user)
        ->post(route('finance.documents.store', $financing), [
            'document' => UploadedFile::fake()->create('agreement.pdf', 20, 'application/pdf'),
        ])
        ->assertRedirect(route('finance.show', $financing));

    $document = $financing->documents()->firstOrFail();

    expect(Storage::disk('local')->exists($document->path))->toBeTrue();

    $this->actingAs($user)
        ->get(route('finance.documents.show', [$financing, $document]))
        ->assertOk();

    $this->actingAs($outsider)
        ->get(route('finance.documents.show', [$financing, $document]))
        ->assertNotFound();
});

test('a duplicate repayment token cannot be reused for a different amount', function () {
    [$financing, $user] = disbursedFinancing();
    $token = (string) Str::uuid();

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            'occurred_on' => now()->toDateString(),
            'amount' => '1000.00',
            'principal_amount' => '1000.00',
            'interest_amount' => '0.00',
            'fee_amount' => '0.00',
            'client_token' => $token,
        ])
        ->assertRedirect();

    $this->actingAs($user)
        ->post(route('finance.repayments.store', $financing), [
            'occurred_on' => now()->toDateString(),
            'amount' => '2000.00',
            'principal_amount' => '2000.00',
            'interest_amount' => '0.00',
            'fee_amount' => '0.00',
            'client_token' => $token,
        ])
        ->assertSessionHasErrors('client_token');

    expect(DecimalQuantity::cents($financing->fresh()->loan_balance))->toBe(9_900_000);
});

/**
 * @return array{0: FarmFinancing, 1: User}
 */
function disbursedFinancing(): array
{
    $farm = Farm::factory()->create(['province' => 'Davao del Sur']);
    $applicant = financeUser();
    $reviewer = financeUser();

    test()->actingAs($applicant)
        ->post(route('finance.store'), financingApplication($farm))
        ->assertRedirect();

    $financing = FarmFinancing::query()->latest('id')->firstOrFail();

    test()->actingAs($reviewer)
        ->post(route('finance.review', $financing))
        ->assertRedirect();

    test()->actingAs($reviewer)
        ->post(route('finance.approve', $financing))
        ->assertRedirect();

    test()->actingAs($reviewer)
        ->post(route('finance.disburse', $financing), [
            'occurred_on' => now()->toDateString(),
            'disbursement_reference' => 'BANK-200',
            'client_token' => (string) Str::uuid(),
        ])
        ->assertRedirect();

    return [$financing->fresh(), $reviewer];
}
