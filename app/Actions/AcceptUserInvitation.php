<?php

namespace App\Actions;

use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AcceptUserInvitation
{
    /**
     * Create the invited account. The role is taken from the invitation,
     * never from the acceptance request. The email is treated as verified
     * because the recipient opened the single-use link.
     *
     * @param  array{password: string}  $data
     */
    public function handle(string $token, array $data): User
    {
        return DB::transaction(function () use ($token, $data): User {
            $invitation = UserInvitation::query()
                ->where('token_hash', UserInvitation::hashToken($token))
                ->lockForUpdate()
                ->first();

            if ($invitation === null || ! $invitation->isOpen()) {
                abort(404);
            }

            if (User::query()->where('email', $invitation->email)->lockForUpdate()->exists()) {
                throw ValidationException::withMessages([
                    'email' => 'An account with this email already exists.',
                ]);
            }

            $user = new User;
            $user->forceFill([
                'name' => $invitation->name,
                'email' => $invitation->email,
                'password' => $data['password'],
                'role' => $invitation->role,
                'email_verified_at' => now(),
            ])->save();

            $invitation->forceFill([
                'accepted_at' => now(),
            ])->save();

            return $user;
        });
    }
}
