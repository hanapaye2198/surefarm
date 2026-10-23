<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeMembershipStatus;
use App\Models\CooperativeMembership;
use App\Models\User;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SuspendCooperativeMembership
{
    public function __construct(
        private RecordAccessEvent $events,
        private RegistryScope $scope,
    ) {}

    public function handle(User $actor, CooperativeMembership $membership): CooperativeMembership
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        return DB::transaction(function () use ($actor, $membership): CooperativeMembership {
            $membership = CooperativeMembership::query()->whereKey($membership->id)->lockForUpdate()->firstOrFail();
            $membership->load('farmer');

            if ($membership->farmer === null || ! $this->scope->canViewFarmer($actor, $membership->farmer)) {
                abort(404);
            }

            if ($membership->status !== CooperativeMembershipStatus::Active) {
                throw ValidationException::withMessages([
                    'membership' => 'Only an active membership can be suspended.',
                ]);
            }

            $membership->update([
                'status' => CooperativeMembershipStatus::Suspended,
                'suspended_at' => now(),
            ]);

            $this->events->handle($actor, AccessEventAction::MembershipSuspended, null, $membership, [
                'farmer_code' => $membership->farmer->farmer_id,
                'cooperative_id' => $membership->cooperative_id,
            ]);

            return $membership;
        });
    }
}
