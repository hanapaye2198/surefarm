<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\FarmVerifierAssignment;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RevokeFarmVerifierAssignment
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, User $subject, FarmVerifierAssignment $assignment): void
    {
        DB::transaction(function () use ($actor, $subject, $assignment): void {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $assignment = FarmVerifierAssignment::query()->lockForUpdate()->findOrFail($assignment->id);

            if ($assignment->user_id !== $subject->id) {
                throw ValidationException::withMessages([
                    'assignment' => 'That assignment belongs to another account.',
                ]);
            }

            if (! $assignment->isOpen()) {
                return;
            }

            $assignment->load('farm:id,farm_id');
            $assignment->forceFill(['revoked_at' => now()])->save();

            $this->events->handle(
                $actor,
                AccessEventAction::AssignmentRevoked,
                $subject,
                $assignment,
                ['farm_code' => $assignment->farm?->farm_id],
            );
        });
    }
}
