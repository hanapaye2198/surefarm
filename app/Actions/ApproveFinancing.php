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

class ApproveFinancing
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

            if (! $this->authorization->manage($actor)) {
                abort(403);
            }

            if ((int) $locked->submitted_by === (int) $actor->id) {
                abort(403, 'You cannot approve a financing request you submitted.');
            }

            if (! $locked->usesLedger() || $locked->status !== FinancingStatus::UnderReview) {
                throw ValidationException::withMessages([
                    'status' => 'Only a financing request under review can be approved.',
                ]);
            }

            $locked->update([
                'status' => FinancingStatus::Approved,
                'approved_at' => now(),
                'approved_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingApproved, null, $locked, [
                'reference' => $locked->reference,
                'amount' => (string) $locked->amount,
                'currency' => $locked->currency,
            ]);

            return $locked;
        });
    }
}
