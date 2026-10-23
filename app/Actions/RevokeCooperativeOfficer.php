<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\CooperativeOfficer;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;

class RevokeCooperativeOfficer
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject, CooperativeOfficer $assignment): CooperativeOfficer
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        return DB::transaction(function () use ($actor, $subject, $assignment): CooperativeOfficer {
            $assignment = CooperativeOfficer::query()->whereKey($assignment->id)->lockForUpdate()->firstOrFail();

            if ($assignment->user_id !== $subject->id) {
                abort(404);
            }

            if ($assignment->revoked_at !== null) {
                return $assignment;
            }

            $assignment->update(['revoked_at' => now()]);

            $this->events->handle($actor, AccessEventAction::OfficerRevoked, $subject, $assignment->cooperative, [
                'cooperative_id' => $assignment->cooperative_id,
            ]);

            return $assignment;
        });
    }
}
