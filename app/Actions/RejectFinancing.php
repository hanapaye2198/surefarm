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

class RejectFinancing
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
        return DB::transaction(function () use ($financing, $data, $actor): FarmFinancing {
            $locked = $this->ledger->lock($financing);

            if (! $this->authorization->manage($actor)) {
                abort(403);
            }

            if ((int) $locked->submitted_by === (int) $actor->id) {
                abort(403, 'You cannot reject a financing request you submitted.');
            }

            if (! $locked->usesLedger() || ! $locked->status->isOpenApplication()) {
                throw ValidationException::withMessages([
                    'reason' => 'Only an open application can be rejected.',
                ]);
            }

            $locked->update([
                'status' => FinancingStatus::Rejected,
                'rejected_at' => now(),
                'rejected_by' => $actor->id,
                'rejection_reason' => $data['reason'],
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingRejected, null, $locked, [
                'reference' => $locked->reference,
                'reason' => $data['reason'],
            ]);

            return $locked;
        });
    }
}
