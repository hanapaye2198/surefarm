<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\RegistryGrant;
use App\Models\User;
use App\RegistryGrantKind;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GrantRegistryAccess
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject, RegistryGrantKind $kind, ?string $province = null): RegistryGrant
    {
        return DB::transaction(function () use ($actor, $subject, $kind, $province): RegistryGrant {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);

            if ($actor->is($subject)) {
                throw ValidationException::withMessages([
                    'kind' => 'You cannot change your own registry scope.',
                ]);
            }

            if ($subject->isSuspended() || ! $subject->hasRole(UserRole::Admin, UserRole::Operations)) {
                throw ValidationException::withMessages([
                    'kind' => 'Registry scope can only be granted to an active administrator or operations account.',
                ]);
            }

            $province = $kind === RegistryGrantKind::Province ? trim((string) $province) : null;

            if ($kind === RegistryGrantKind::Province && $province === '') {
                throw ValidationException::withMessages([
                    'province' => 'Enter the province this account may work in.',
                ]);
            }

            $existing = RegistryGrant::query()
                ->where('user_id', $subject->id)
                ->where('kind', $kind)
                ->whereNull('revoked_at')
                ->when(
                    $province === null,
                    fn ($query) => $query->whereNull('province'),
                    fn ($query) => $query->where('province', $province),
                )
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                return $existing;
            }

            $grant = RegistryGrant::query()->create([
                'user_id' => $subject->id,
                'kind' => $kind,
                'province' => $province,
                'granted_by' => $actor->id,
            ]);

            $this->events->handle(
                $actor,
                AccessEventAction::GrantCreated,
                $subject,
                $grant,
                [
                    'kind' => $kind->value,
                    'province' => $province,
                ],
            );

            return $grant;
        });
    }
}
