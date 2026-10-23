<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\CooperativeOfficer;
use App\Models\Farmer;
use App\Models\FarmVerifierAssignment;
use App\Models\RegistryGrant;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateUserRole
{
    public function __construct(
        private RecordAccessEvent $events,
        private RevokeRegistryGrant $revokeGrants,
        private RevokeFarmVerifierAssignment $revokeAssignments,
        private RevokeCooperativeOfficer $revokeOfficers,
        private UnlinkFarmerAccount $unlinkFarmer,
    ) {}

    public function handle(User $actor, User $subject, UserRole $role): User
    {
        return DB::transaction(function () use ($actor, $subject, $role): User {
            $this->ensureAdministrator($actor);

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);

            if ($actor->is($subject)) {
                throw ValidationException::withMessages([
                    'role' => 'You cannot change your own role.',
                ]);
            }

            if ($subject->role === $role) {
                return $subject;
            }

            if ($role !== UserRole::Admin && $subject->isLastActiveAdministrator(lock: true)) {
                throw ValidationException::withMessages([
                    'role' => 'The last active administrator cannot be demoted.',
                ]);
            }

            $previous = $subject->role;
            $subject->forceFill(['role' => $role])->save();

            $this->events->handle($actor, AccessEventAction::RoleChanged, $subject, null, [
                'from' => $previous->value,
                'to' => $role->value,
            ]);

            $this->dropScopeThatNoLongerApplies($actor, $subject);

            return $subject;
        });
    }

    private function dropScopeThatNoLongerApplies(User $actor, User $subject): void
    {
        if (! $subject->hasRole(UserRole::Admin, UserRole::Operations)) {
            RegistryGrant::query()
                ->where('user_id', $subject->id)
                ->whereNull('revoked_at')
                ->get()
                ->each(fn (RegistryGrant $grant) => $this->revokeGrants->handle($actor, $subject, $grant));
        }

        if ($subject->role !== UserRole::FieldVerifier) {
            FarmVerifierAssignment::query()
                ->where('user_id', $subject->id)
                ->whereNull('revoked_at')
                ->get()
                ->each(fn (FarmVerifierAssignment $assignment) => $this->revokeAssignments->handle($actor, $subject, $assignment));
        }

        if ($subject->role !== UserRole::CooperativeOfficer) {
            CooperativeOfficer::query()
                ->where('user_id', $subject->id)
                ->whereNull('revoked_at')
                ->get()
                ->each(fn (CooperativeOfficer $assignment) => $this->revokeOfficers->handle($actor, $subject, $assignment));
        }

        if ($subject->role !== UserRole::Farmer && Farmer::query()->where('user_id', $subject->id)->exists()) {
            $this->unlinkFarmer->handle($actor, $subject);
        }
    }

    private function ensureAdministrator(User $actor): void
    {
        if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }
    }
}
