<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Farm;
use App\Models\FarmVerifierAssignment;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssignFarmVerifier
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * Give a field verifier access to one farm. The assignment does not
     * grant finance, identity, or inventory changes.
     */
    public function handle(User $actor, User $subject, string $farmCode): FarmVerifierAssignment
    {
        return DB::transaction(function () use ($actor, $subject, $farmCode): FarmVerifierAssignment {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);

            if ($subject->role !== UserRole::FieldVerifier || $subject->isSuspended()) {
                throw ValidationException::withMessages([
                    'farm_code' => 'Only an active field verifier can be assigned.',
                ]);
            }

            $farm = Farm::query()->where('farm_id', trim($farmCode))->first();

            if ($farm === null) {
                throw ValidationException::withMessages([
                    'farm_code' => 'No farm uses that ID.',
                ]);
            }

            $assignment = FarmVerifierAssignment::query()
                ->where('user_id', $subject->id)
                ->where('farm_id', $farm->id)
                ->lockForUpdate()
                ->first();

            if ($assignment?->isOpen()) {
                return $assignment;
            }

            if ($assignment === null) {
                $assignment = new FarmVerifierAssignment([
                    'user_id' => $subject->id,
                    'farm_id' => $farm->id,
                ]);
            }

            $assignment->forceFill([
                'assigned_by' => $actor->id,
                'assigned_at' => now(),
                'revoked_at' => null,
            ])->save();

            $this->events->handle(
                $actor,
                AccessEventAction::AssignmentCreated,
                $subject,
                $assignment,
                ['farm_code' => $farm->farm_id],
            );

            return $assignment;
        });
    }
}
