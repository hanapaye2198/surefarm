<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CooperativeStatus;
use App\Models\Cooperative;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ChangeCooperativeStatus
{
    public function __construct(private RecordAccessEvent $events) {}

    public function handle(User $actor, Cooperative $cooperative, CooperativeStatus $status): Cooperative
    {
        if ($actor->isSuspended() || ! $actor->canAccess(UserRole::Operations)) {
            abort(403);
        }

        return DB::transaction(function () use ($actor, $cooperative, $status): Cooperative {
            $cooperative = Cooperative::query()->whereKey($cooperative->id)->lockForUpdate()->firstOrFail();

            if ($cooperative->status === $status) {
                throw ValidationException::withMessages([
                    'status' => 'The cooperative already has that status.',
                ]);
            }

            $from = $cooperative->status;
            $cooperative->update(['status' => $status]);

            $this->events->handle($actor, AccessEventAction::CooperativeStatusChanged, null, $cooperative, [
                'from' => $from->value,
                'to' => $status->value,
            ]);

            return $cooperative;
        });
    }
}
