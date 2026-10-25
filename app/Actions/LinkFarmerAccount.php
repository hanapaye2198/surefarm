<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Farmer;
use App\Models\User;
use App\Notifications\FarmerRegistrationReceivedNotification;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class LinkFarmerAccount
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * Connect an account to a farmer record by the farmer's public ID.
     * Name, phone, and email are never used as a match.
     */
    public function handle(User $actor, User $subject, string $farmerCode): Farmer
    {
        $linkedNow = false;
        $farmer = DB::transaction(function () use ($actor, $subject, $farmerCode, &$linkedNow): Farmer {
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
            $linkedNow = true;

            $this->events->handle(
                $actor,
                AccessEventAction::FarmerLinked,
                $subject,
                $farmer,
                ['farmer_code' => $farmer->farmer_id],
            );

            return $farmer;
        });

        if ($linkedNow) {
            try {
                $farmer->loadMissing('user');
                $farmer->user?->notify(new FarmerRegistrationReceivedNotification($farmer));
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $farmer;
    }

    private function ensureAdministrator(User $actor): void
    {
        if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
            abort(403);
        }
    }
}
