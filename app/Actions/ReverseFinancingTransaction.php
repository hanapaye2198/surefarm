<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReverseFinancingTransaction
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(FarmFinancing $financing, FinancingTransaction $transaction, array $data, User $actor): FinancingTransaction
    {
        try {
            return DB::transaction(fn (): FinancingTransaction => $this->reverse($financing, $transaction, $data, $actor));
        } catch (UniqueConstraintViolationException) {
            $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->first();

            if ($existing instanceof FinancingTransaction) {
                return $existing;
            }

            throw ValidationException::withMessages([
                'client_token' => 'This reversal was already submitted.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function reverse(FarmFinancing $financing, FinancingTransaction $transaction, array $data, User $actor): FinancingTransaction
    {
        $locked = $this->ledger->lock($financing);
        $original = FinancingTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
        $existing = FinancingTransaction::query()->where('idempotency_key', $data['client_token'])->lockForUpdate()->first();

        if ($existing instanceof FinancingTransaction) {
            if ((int) $existing->reverses_transaction_id !== (int) $original->id) {
                throw ValidationException::withMessages([
                    'client_token' => 'This submission was already used for a different reversal.',
                ]);
            }

            return $existing;
        }

        $locked->unsetRelation('transactions');

        if (! $this->authorization->canReverse($actor, $locked, $original)) {
            if (! $this->authorization->manage($actor)) {
                abort(403);
            }

            throw ValidationException::withMessages([
                'notes' => 'This transaction cannot be reversed.',
            ]);
        }

        if ($data['occurred_on'] > now()->toDateString() || $data['occurred_on'] < $original->occurred_on->toDateString()) {
            throw ValidationException::withMessages([
                'occurred_on' => 'Reversal date must be on or after the original transaction and cannot be in the future.',
            ]);
        }

        if ($original->type === FinancingTransactionType::Disbursement) {
            $others = $this->ledger->activeTransactions($locked)
                ->contains(fn (FinancingTransaction $row): bool => $row->id !== $original->id);

            if ($others) {
                throw ValidationException::withMessages([
                    'notes' => 'Reverse later payments and charges before reversing the disbursement.',
                ]);
            }
        }

        $projected = $this->ledger->apply(
            $this->ledger->outstandingCents($locked),
            $original->component,
            $original->direction->opposite(),
            $this->ledger->cents($original->amount),
        );
        $this->ledger->assertNonNegative($projected, [
            'principal' => 'notes',
            'interest' => 'notes',
            'fee' => 'notes',
        ]);

        $reversal = $this->ledger->post($locked, [
            'type' => FinancingTransactionType::Reversal,
            'amount' => (string) $original->amount,
            'component' => $original->component,
            'direction' => $original->direction->opposite(),
            'occurred_on' => $data['occurred_on'],
            'group_reference' => $original->group_reference,
            'recorded_by' => $actor->id,
            'reverses_transaction_id' => $original->id,
            'idempotency_key' => $data['client_token'],
            'notes' => $data['notes'],
            'external_reference' => $original->reference,
        ]);

        $previous = $locked->status;
        $this->ledger->refreshPosition($locked);
        $locked->refresh();

        $this->accessEvents->handle($actor, AccessEventAction::FinancingReversed, null, $locked, [
            'reference' => $reversal->reference,
            'reverses' => $original->reference,
            'amount' => (string) $original->amount,
            'currency' => $original->currency,
        ]);

        if ($previous !== $locked->status && $locked->status === FinancingStatus::Completed) {
            $this->accessEvents->handle($actor, AccessEventAction::FinancingCompleted, null, $locked, [
                'reference' => $locked->reference,
            ]);
        }

        return $reversal;
    }
}
