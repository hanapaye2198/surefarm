<?php

namespace App\Actions;

use App\AccessEventAction;
use App\FinancingStatus;
use App\Models\FarmFinancing;
use App\Models\User;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelFinancing
{
    public function __construct(
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    public function handle(FarmFinancing $financing, User $actor): FarmFinancing
    {
        return DB::transaction(function () use ($financing, $actor): FarmFinancing {
            $locked = $this->ledger->lock($financing);

            if (! $this->authorization->canCancel($actor, $locked)) {
                if (! $this->authorization->manage($actor)) {
                    abort(403);
                }

                throw ValidationException::withMessages([
                    'status' => 'Only an application that has not been disbursed can be cancelled.',
                ]);
            }

            $locked->update([
                'status' => FinancingStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingCancelled, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }
}
