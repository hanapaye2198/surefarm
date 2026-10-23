<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SuspendUserAccount
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject): User
    {
        return DB::transaction(function () use ($actor, $subject): User {
            $this->ensureAdministrator($actor);

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);

            if ($actor->is($subject)) {
                throw ValidationException::withMessages([
                    'user' => 'You cannot suspend your own account.',
                ]);
            }

            if ($subject->isSuspended()) {
                return $subject;
            }

            if ($subject->isLastActiveAdministrator(lock: true)) {
                throw ValidationException::withMessages([
                    'user' => 'The last active administrator cannot be suspended.',
                ]);
            }

            $subject->forceFill([
                'suspended_at' => now(),
                'remember_token' => Str::random(60),
            ])->save();

            if (Schema::hasTable('sessions')) {
                DB::table('sessions')->where('user_id', $subject->id)->delete();
            }

            $this->events->handle($actor, AccessEventAction::UserSuspended, $subject);

            return $subject;
        });
    }

    private function ensureAdministrator(User $actor): void
    {
        if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }
    }
}
