<?php

namespace App\Actions;

use App\AccessEventAction;
use App\Models\Farmer;
use App\Models\User;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UnlinkFarmerAccount
{
    public function __construct(private RecordAccessEvent $events) {}

    /**
     * Remove the account link. The farmer, farms, and history stay.
     */
    public function handle(User $actor, User $subject): void
    {
        DB::transaction(function () use ($actor, $subject): void {
            if ($actor->role !== UserRole::Admin || $actor->isSuspended()) {
                abort(403);
            }

            $subject = User::query()->lockForUpdate()->findOrFail($subject->id);
            $farmer = Farmer::query()->where('user_id', $subject->id)->lockForUpdate()->first();

            if ($farmer === null) {
                throw ValidationException::withMessages([
                    'farmer_code' => 'This account is not linked to a farmer.',
                ]);
            }

            $code = $farmer->farmer_id;
            $farmer->forceFill(['user_id' => null])->save();

            $this->events->handle(
                $actor,
                AccessEventAction::FarmerUnlinked,
                $subject,
                $farmer,
                ['farmer_code' => $code],
            );
        });
    }
}
