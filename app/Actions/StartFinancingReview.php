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

class StartFinancingReview
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
            $this->assertDecision($actor, $locked, FinancingStatus::Submitted, 'Only a submitted application can move into review.');
            $locked->update([
                'status' => FinancingStatus::UnderReview,
                'reviewed_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::FinancingReviewStarted, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    private function assertDecision(User $actor, FarmFinancing $financing, FinancingStatus $expected, string $message): void
    {
        if (! $this->authorization->manage($actor)) {
            abort(403);
        }

        if ((int) $financing->submitted_by === (int) $actor->id) {
            abort(403, 'You cannot review a financing request you submitted.');
        }

        if (! $financing->usesLedger() || $financing->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => $message,
            ]);
        }
    }
}
