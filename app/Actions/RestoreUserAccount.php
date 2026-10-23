<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;

class RestoreUserAccount
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject): User
    {
        return DB::transaction(function () use ($actor, $subject): User {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);
            $subject->forceFill(['suspended_at' => null])->save();

            $this->events->handle($actor, AccessEventAction::UserRestored, $subject);

            return $subject;
        });
    }
}
