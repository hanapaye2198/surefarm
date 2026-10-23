<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeMembershipStatus;
use App\CooperativeStatus;
use App\Models\CooperativeMembership;
use App\Models\User;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReactivateCooperativeMembership
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
            $membership->load(['farmer', 'cooperative']);

            if ($membership->farmer === null || ! $this->scope->canViewFarmer($actor, $membership->farmer)) {
                abort(404);
            }

            if ($membership->status !== CooperativeMembershipStatus::Suspended) {
                throw ValidationException::withMessages([
                    'membership' => 'Only a suspended membership can be reactivated.',
                ]);
            }

            if ($membership->cooperative?->status !== CooperativeStatus::Active) {
                throw ValidationException::withMessages([
                    'membership' => 'Reactivate the cooperative before reactivating this membership.',
                ]);
            }

            $membership->update([
                'status' => CooperativeMembershipStatus::Active,
                'suspended_at' => null,
            ]);

            $this->events->handle($actor, AccessEventAction::MembershipReactivated, null, $membership, [
                'farmer_code' => $membership->farmer->farmer_id,
                'cooperative_id' => $membership->cooperative_id,
            ]);

            return $membership;
        });
    }
}
