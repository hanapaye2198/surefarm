<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RevokeUserInvitation
{
    public function handle(User $actor, UserInvitation $invitation): UserInvitation
    {
        return DB::transaction(function () use ($actor, $invitation): UserInvitation {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $invitation = UserInvitation::query()->lockForUpdate()->findOrFail($invitation->id);

            if ($invitation->accepted_at !== null) {
                throw ValidationException::withMessages([
                    'invitation' => 'An accepted invitation cannot be revoked.',
                ]);
            }

            if ($invitation->revoked_at === null) {
                $invitation->forceFill(['revoked_at' => now()])->save();
            }

            return $invitation;
        });
    }
}
