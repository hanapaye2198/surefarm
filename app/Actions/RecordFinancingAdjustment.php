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
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RecordFinancingAdjustment
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmFinancing $financing, array $data, User $actor): FinancingTransaction
    {
        try {
            return DB::transaction(fn (): FinancingTransaction => $this->adjust($financing, $data, $actor));
        } catch (UniqueConstraintViolationException) {
            $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->first();

            if ($existing instanceof FinancingTransaction) {
                return $existing;
            }

            throw ValidationException::withMessages([
                'client_token' => 'This adjustment was already submitted.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function adjust(FarmFinancing $financing, array $data, User $actor): FinancingTransaction
    {
        $locked = $this->ledger->lock($financing);
        $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->lockForUpdate()->first();

        if ($existing instanceof FinancingTransaction) {
            if ((int) $existing->farm_financing_id !== (int) $locked->id || $this->ledger->cents($existing->amount) !== $this->ledger->cents($data['amount'])) {
                throw ValidationException::withMessages([
                    'client_token' => 'This submission was already used for a different adjustment.',
                ]);
            }

            return $existing;
        }

        if (! $this->authorization->canAdjust($actor, $locked)) {
            if (! $this->authorization->manage($actor)) {
                abort(403);
            }

            throw ValidationException::withMessages([
                'amount' => 'Adjustments can be posted only while the agreement is disbursed or defaulted.',
            ]);
        }

        if ($data['occurred_on'] > now()->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Adjustment date cannot be in the future.',
            ]);
        }

        if ($locked->date_granted !== null && $data['occurred_on'] < $locked->date_granted->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Adjustment date cannot be before the disbursement date.',
            ]);
        }

        $component = FinancingComponent::from($data['component']);
        $direction = FinancingDirection::from($data['direction']);
        $amount = $this->ledger->cents($data['amount']);

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Adjustment amount must be greater than zero.',
            ]);
        }

        $projected = $this->ledger->apply($this->ledger->outstandingCents($locked), $component, $direction, $amount);
        $this->ledger->assertNonNegative($projected, [
            'principal' => 'amount',
            'interest' => 'amount',
            'fee' => 'amount',
        ]);

        $previous = $locked->status;
        $transaction = $this->ledger->post($locked, [
            'type' => FinancingTransactionType::Adjustment,
            'amount' => $data['amount'],
            'component' => $component,
            'direction' => $direction,
            'occurred_on' => $data['occurred_on'],
            'group_reference' => (string) Str::ulid(),
            'recorded_by' => $actor->id,
            'idempotency_key' => $data['client_token'],
            'notes' => $data['notes'],
        ]);
        $this->ledger->refreshPosition($locked);
        $locked->refresh();

        $this->accessEvents->handle($actor, AccessEventAction::FinancingAdjusted, null, $locked, [
            'reference' => $transaction->reference,
            'amount' => $data['amount'],
            'currency' => $locked->currency,
            'component' => $component->value,
            'direction' => $direction->value,
        ]);

        if ($previous !== $locked->status && $locked->status === FinancingStatus::Completed) {
            $this->accessEvents->handle($actor, AccessEventAction::FinancingCompleted, null, $locked, [
                'reference' => $locked->reference,
            ]);
        }

        return $transaction;
    }
}
