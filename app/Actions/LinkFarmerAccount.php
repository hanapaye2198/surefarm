<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LinkFarmerAccount
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * Connect an account to a farmer record by the farmer's public ID.
     * Name, phone, and email are never used as a match.
     */
    public function handle(User $actor, User $subject, string $farmerCode): Farmer
    {
        return DB::transaction(function () use ($actor, $subject, $farmerCode): Farmer {
            $this->ensureAdministrator($actor);

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);

            if ($subject->role !== UserRole::Farmer || $subject->isSuspended()) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'Only an active farmer account can be linked.',
                ]);
            }

            $farmer = Farmer::query()
                ->where('farmer_id', trim($farmerCode))
                ->lockForUpdate()
                ->first();

            if ($farmer === null) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'No farmer record uses that ID.',
                ]);
            }

            $existing = Farmer::query()
                ->where('user_id', $subject->id)
                ->lockForUpdate()
                ->first();

            if ($existing !== null && $existing->isNot($farmer)) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'This account is already linked to another farmer.',
                ]);
            }

            if ($farmer->user_id !== null && $farmer->user_id !== $subject->id) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'That farmer record is already linked to an account.',
                ]);
            }

            if ($farmer->user_id === $subject->id) {
                return $farmer;
            }

            $farmer->forceFill(['user_id' => $subject->id])->save();

            $this->events->handle(
                $actor,
                AccessEventAction::FarmerLinked,
                $subject,
                $farmer,
                ['farmer_code' => $farmer->farmer_id],
            );

            return $farmer;
        });
    }

    private function ensureAdministrator(User $actor): void
    {
        if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }
    }
}
