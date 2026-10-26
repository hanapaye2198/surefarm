<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingReconciliationStatus;
use App\Models\FarmFinancing;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReconcileFinancingTransaction
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    public function handle(FarmFinancing $financing, FinancingTransaction $transaction, User $actor): FinancingTransaction
    {
        return DB::transaction(function () use ($financing, $transaction, $actor): FinancingTransaction {
            $locked = $this->ledger->lock($financing);
            $posted = FinancingTransaction::query()->whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            $locked->unsetRelation('transactions');

            if ($posted->reconciliation_status === FinancingReconciliationStatus::Reconciled) {
                return $posted;
            }

            if (! $this->authorization->canReconcile($actor, $locked, $posted)) {
                if (! $this->authorization->manage($actor)) {
                    abort(403);
                }

                throw ValidationException::withMessages([
                    'status' => 'Only a recorded cash movement can be reconciled.',
                ]);
            }

            $posted->update([
                'reconciliation_status' => FinancingReconciliationStatus::Reconciled,
                'reconciled_at' => now(),
                'reconciled_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingReconciled, null, $locked, [
                'reference' => $posted->reference,
                'amount' => (string) $posted->amount,
                'currency' => $posted->currency,
            ]);

            return $posted;
        });
    }
}
