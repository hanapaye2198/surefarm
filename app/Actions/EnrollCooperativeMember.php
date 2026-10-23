<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeMembershipOrigin;
use App\CooperativeMembershipStatus;
use App\CooperativeStatus;
use App\Models\Cooperative;
use App\Models\CooperativeMembership;
use App\Models\Farmer;
use App\Models\User;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EnrollCooperativeMember
{
    public function __construct(
        private RecordAccessEvent $events,
        private RegistryScope $scope,
    ) {}

    /**
     * A farmer keeps one open membership. Joining another cooperative
     * requires the current membership to be ended first.
     */
    public function handle(User $actor, Farmer $farmer, Cooperative $cooperative): CooperativeMembership
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        if (! $this->scope->canViewFarmer($actor, $farmer)) {
            abort(404);
        }

        return DB::transaction(function () use ($actor, $farmer, $cooperative): CooperativeMembership {
            $farmer = Farmer::query()->whereKey($farmer->id)->lockForUpdate()->firstOrFail();
            $cooperative = Cooperative::query()->whereKey($cooperative->id)->lockForUpdate()->firstOrFail();

            if ($cooperative->status !== CooperativeStatus::Active) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'Members can join an active cooperative.',
                ]);
            }

            $open = CooperativeMembership::query()
                ->where('farmer_id', $farmer->id)
                ->whereNotNull('open_slot')
                ->lockForUpdate()
                ->first();

            if ($open instanceof CooperativeMembership && $open->cooperative_id === $cooperative->id) {
                return $open;
            }

            if ($open instanceof CooperativeMembership) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'End the current membership before joining another cooperative.',
                ]);
            }

            $membership = CooperativeMembership::query()->create([
                'cooperative_id' => $cooperative->id,
                'farmer_id' => $farmer->id,
                'status' => CooperativeMembershipStatus::Active,
                'joined_on' => now()->toDateString(),
                'open_slot' => $farmer->id,
                'origin' => CooperativeMembershipOrigin::Recorded,
                'recorded_by' => $actor->id,
            ]);

            $farmer->forceFill(['cooperative_id' => $cooperative->id])->save();

            $this->events->handle($actor, AccessEventAction::MembershipStarted, null, $membership, [
                'farmer_code' => $farmer->farmer_id,
                'cooperative_id' => $cooperative->id,
            ]);

            return $membership;
        });
    }
}
