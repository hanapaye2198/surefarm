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

class DefaultFinancing
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

            if (! $this->authorization->canDefault($actor, $locked)) {
                if (! $this->authorization->manage($actor)) {
                    abort(403);
                }

                throw ValidationException::withMessages([
                    'reason' => 'Only a disbursed agreement can be marked in default.',
                ]);
            }

            $locked->update([
                'status' => FinancingStatus::Defaulted,
                'defaulted_at' => now(),
                'defaulted_by' => $actor->id,
                'default_reason' => $data['reason'],
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingDefaulted, null, $locked, [
                'reference' => $locked->reference,
                'reason' => $data['reason'],
            ]);

            return $locked;
        });
    }
}
