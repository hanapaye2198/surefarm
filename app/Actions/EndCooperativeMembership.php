<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeMembershipStatus;
use App\Models\CooperativeMembership;
use App\Models\Farmer;
use App\Models\User;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EndCooperativeMembership
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
            $farmer = Farmer::query()->whereKey($membership->farmer_id)->lockForUpdate()->first();

            if (! $farmer instanceof Farmer || ! $this->scope->canViewFarmer($actor, $farmer)) {
                abort(404);
            }

            if ($membership->status === CooperativeMembershipStatus::Ended) {
                throw ValidationException::withMessages([
                    'membership' => 'This membership has already ended.',
                ]);
            }

            $membership->update([
                'status' => CooperativeMembershipStatus::Ended,
                'ended_on' => now()->toDateString(),
                'open_slot' => null,
            ]);

            if ($farmer->cooperative_id === $membership->cooperative_id) {
                $farmer->forceFill(['cooperative_id' => null])->save();
            }

            $this->events->handle($actor, AccessEventAction::MembershipEnded, null, $membership, [
                'farmer_code' => $farmer->farmer_id,
                'cooperative_id' => $membership->cooperative_id,
            ]);

            return $membership;
        });
    }
}
