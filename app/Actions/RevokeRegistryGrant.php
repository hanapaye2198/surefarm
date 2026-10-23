<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RevokeRegistryGrant
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject, RegistryGrant $grant): void
    {
        DB::transaction(function () use ($actor, $subject, $grant): void {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $grant = RegistryGrant::query()->lockForUpdate()->findOrFail($grant->id);

            if ($grant->user_id !== $subject->id) {
                throw ValidationException::withMessages([
                    'grant' => 'That scope belongs to another account.',
                ]);
            }

            if (! $grant->isOpen()) {
                return;
            }

            if ($actor->is($subject) && $grant->kind === RegistryGrantKind::Platform) {
                throw ValidationException::withMessages([
                    'grant' => 'You cannot remove your own platform access.',
                ]);
            }

            if ($this->isLastAdministratorPlatformGrant($subject, $grant)) {
                throw ValidationException::withMessages([
                    'grant' => 'The last active administrator must keep platform access.',
                ]);
            }

            $grant->forceFill(['revoked_at' => now()])->save();

            $this->events->handle(
                $actor,
                AccessEventAction::GrantRevoked,
                $subject,
                $grant,
                [
                    'kind' => $grant->kind->value,
                    'province' => $grant->province,
                ],
            );
        });
    }

    private function isLastAdministratorPlatformGrant(User $subject, RegistryGrant $grant): bool
    {
        if ($grant->kind !== RegistryGrantKind::Platform || $subject->role !== UserRole::Admin || $subject->isSuspended()) {
            return false;
        }

        return ! RegistryGrant::query()
            ->where('kind', RegistryGrantKind::Platform)
            ->whereNull('revoked_at')
            ->where('user_id', '!=', $subject->id)
            ->whereHas('user', fn ($query) => $query->where('role', UserRole::Admin)->whereNull('suspended_at'))
            ->lockForUpdate()
            ->exists();
    }
}
