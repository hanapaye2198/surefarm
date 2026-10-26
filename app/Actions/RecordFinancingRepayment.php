<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingComponent;
use App\FinancingDirection;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use App\Support\DecimalQuantity;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RecordFinancingRepayment
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmFinancing $financing, array $data, User $actor): FarmFinancing
    {
        try {
            return DB::transaction(fn (): FarmFinancing => $this->receive($financing, $data, $actor));
        } catch (UniqueConstraintViolationException) {
            $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->first();

            if ($existing instanceof FinancingTransaction && (int) $existing->farm_financing_id === (int) $financing->id) {
                return $financing->refresh();
            }

            throw ValidationException::withMessages([
                'client_token' => 'This payment was already submitted.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function receive(FarmFinancing $financing, array $data, User $actor): FarmFinancing
    {
        $locked = $this->ledger->lock($financing);
        $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->lockForUpdate()->first();

        if ($existing instanceof FinancingTransaction) {
            $this->assertSameReceipt($existing, $locked, $data);

            return $locked;
        }

        if (! $this->authorization->manage($actor)) {
            abort(403);
        }

        if (! $this->authorization->canRepay($actor, $locked)) {
            throw ValidationException::withMessages([
                'amount' => 'Payments can be recorded only while the agreement is disbursed or defaulted.',
            ]);
        }

        if ($data['occurred_on'] > now()->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Payment date cannot be in the future.',
            ]);
        }

        if ($locked->date_granted !== null && $data['occurred_on'] < $locked->date_granted->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Payment date cannot be before the disbursement date.',
            ]);
        }

        $received = $this->ledger->cents($data['amount']);
        $parts = [
            FinancingComponent::Principal->value => $this->ledger->cents($data['principal_amount']),
            FinancingComponent::Interest->value => $this->ledger->cents($data['interest_amount']),
            FinancingComponent::Fee->value => $this->ledger->cents($data['fee_amount']),
        ];

        if ($received <= 0 || array_sum($parts) !== $received) {
            throw ValidationException::withMessages([
                'amount' => 'The amount received must equal the principal, interest, and fee allocation.',
            ]);
        }

        if (min($parts) < 0) {
            throw ValidationException::withMessages([
                'amount' => 'Allocation amounts cannot be negative.',
            ]);
        }

        $projected = $this->ledger->outstandingCents($locked);

        foreach ($parts as $component => $cents) {
            if ($cents === 0) {
                continue;
            }

            $projected = $this->ledger->apply(
                $projected,
                FinancingComponent::from($component),
                FinancingDirection::Decrease,
                $cents,
            );
        }

        $this->ledger->assertNonNegative($projected, [
            'principal' => 'principal_amount',
            'interest' => 'interest_amount',
            'fee' => 'fee_amount',
        ]);

        $group = (string) Str::ulid();
        $first = true;
        $previous = $locked->status;

        foreach ([
            FinancingComponent::Principal->value => FinancingTransactionType::PrincipalRepayment,
            FinancingComponent::Interest->value => FinancingTransactionType::InterestPayment,
            FinancingComponent::Fee->value => FinancingTransactionType::FeePayment,
        ] as $component => $type) {
            if ($parts[$component] === 0) {
                continue;
            }

            $this->ledger->post($locked, [
                'type' => $type,
                'amount' => DecimalQuantity::fromCents($parts[$component]),
                'component' => FinancingComponent::from($component),
                'direction' => FinancingDirection::Decrease,
                'occurred_on' => $data['occurred_on'],
                'group_reference' => $group,
                'payment_method' => $data['payment_method'] ?? null,
                'external_reference' => $data['external_reference'] ?? null,
                'recorded_by' => $actor->id,
                'idempotency_key' => $first ? $data['client_token'] : null,
                'notes' => $data['notes'] ?? null,
            ]);
            $first = false;
        }

        $this->ledger->refreshPosition($locked);
        $locked->refresh();

        $this->accessEvents->handle($actor, AccessEventAction::FinancingRepaymentRecorded, null, $locked, [
            'reference' => $locked->reference,
            'amount' => DecimalQuantity::fromCents($received),
            'currency' => $locked->currency,
            'external_reference' => $data['external_reference'] ?? null,
        ]);

        if ($previous !== $locked->status && $locked->status === FinancingStatus::Completed) {
            $this->accessEvents->handle($actor, AccessEventAction::FinancingCompleted, null, $locked, [
                'reference' => $locked->reference,
            ]);
        }

        return $locked;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertSameReceipt(FinancingTransaction $existing, FarmFinancing $financing, array $data): void
    {
        if ((int) $existing->farm_financing_id !== (int) $financing->id || $existing->group_reference === null) {
            throw ValidationException::withMessages([
                'client_token' => 'This submission was already used for a different transaction.',
            ]);
        }

        $rows = FinancingTransaction::query()->where('group_reference', $existing->group_reference)->get();
        $received = 0;

        foreach ($rows as $row) {
            $received += $this->ledger->cents($row->amount);
        }

        if ($received !== $this->ledger->cents($data['amount'])) {
            throw ValidationException::withMessages([
                'client_token' => 'This submission was already used for a different payment.',
            ]);
        }
    }
}
