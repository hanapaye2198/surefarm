<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use App\Notifications\UserInvitationNotification;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class InviteUser
{
    /**
     * Issue a single-use invitation and email its accept link.
     * A newer invitation replaces any still-open invitation for the same address.
     *
     * @param  array{name: string, email: string, role: string}  $data
     */
    public function handle(array $data, User $actor): UserInvitation
    {
        $this->ensureAdministrator($actor);

        $email = Str::lower(trim($data['email']));
        $role = UserRole::from($data['role']);
        $token = Str::random(64);

        $invitation = DB::transaction(function () use ($data, $actor, $email, $role, $token): UserInvitation {
            if (User::query()->where('email', $email)->lockForUpdate()->exists()) {
                throw ValidationException::withMessages([
                    'email' => 'An account with this email already exists.',
                ]);
            }

            UserInvitation::query()
                ->where('email', $email)
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->lockForUpdate()
                ->update(['revoked_at' => now()]);

            return UserInvitation::query()->create([
                'email' => $email,
                'name' => trim($data['name']),
                'role' => $role,
                'token_hash' => UserInvitation::hashToken($token),
                'expires_at' => now()->addHours((int) config('auth.invitation_ttl_hours')),
                'invited_by' => $actor->id,
            ]);
        });

        Notification::route('mail', $invitation->email)->notify(
            new UserInvitationNotification(
                recipientName: $invitation->name,
                roleLabel: $invitation->role->label(),
                acceptUrl: route('invitations.show', ['token' => $token]),
            ),
        );

        return $invitation;
    }

    private function ensureAdministrator(User $actor): void
    {
        if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }
    }
}
