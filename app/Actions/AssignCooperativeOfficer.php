<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Cooperative;
use App\Models\CooperativeOfficer;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssignCooperativeOfficer
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, Cooperative $cooperative, string $email): CooperativeOfficer
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        return DB::transaction(function () use ($actor, $cooperative, $email): CooperativeOfficer {
            $subject = User::query()->where('email', trim($email))->lockForUpdate()->first();

            if (! $subject instanceof User || $subject->isSuspended() || $subject->role !== UserRole::CooperativeOfficer) {
                throw ValidationException::withMessages([
                    'email' => 'Enter the email of an active cooperative officer account.',
                ]);
            }

            $assignment = CooperativeOfficer::query()
                ->where('user_id', $subject->id)
                ->where('cooperative_id', $cooperative->id)
                ->lockForUpdate()
                ->first();

            if ($assignment instanceof CooperativeOfficer && $assignment->isOpen()) {
                return $assignment;
            }

            if ($assignment instanceof CooperativeOfficer) {
                $assignment->update([
                    'assigned_by' => $actor->id,
                    'assigned_at' => now(),
                    'revoked_at' => null,
                ]);
            } else {
                $assignment = CooperativeOfficer::query()->create([
                    'user_id' => $subject->id,
                    'cooperative_id' => $cooperative->id,
                    'assigned_by' => $actor->id,
                    'assigned_at' => now(),
                ]);
            }

            $this->events->handle($actor, AccessEventAction::OfficerAssigned, $subject, $cooperative, [
                'cooperative_id' => $cooperative->id,
            ]);

            return $assignment;
        });
    }
}
