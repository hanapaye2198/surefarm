<?php

namespace Database\Factories;

use App\CooperativeMembershipOrigin;
use App\CooperativeMembershipStatus;
use App\Models\Cooperative;
use App\Models\CooperativeMembership;
use App\Models\Farmer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CooperativeMembership>
 */
class CooperativeMembershipFactory extends Factory
{
    public function configure(): static
    {
        return $this->afterCreating(function (CooperativeMembership $membership): void {
            if ($membership->status !== CooperativeMembershipStatus::Ended && $membership->open_slot === null) {
                $membership->forceFill(['open_slot' => $membership->farmer_id])->save();
                $membership->farmer()->update(['cooperative_id' => $membership->cooperative_id]);
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'cooperative_id' => Cooperative::factory(),
            'farmer_id' => Farmer::factory(),
            'status' => CooperativeMembershipStatus::Active,
            'joined_on' => now()->toDateString(),
            'ended_on' => null,
            'suspended_at' => null,
            'open_slot' => null,
            'origin' => CooperativeMembershipOrigin::Recorded,
            'recorded_by' => null,
        ];
    }
}
