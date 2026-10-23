<?php

namespace App\Models;

use App\CooperativeMembershipOrigin;
use App\CooperativeMembershipStatus;
use Database\Factories\CooperativeMembershipFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property CooperativeMembershipStatus $status
 * @property CooperativeMembershipOrigin $origin
 * @property Carbon|null $joined_on
 * @property Carbon|null $ended_on
 * @property Carbon|null $suspended_at
 */
#[Fillable([
    'cooperative_id',
    'farmer_id',
    'status',
    'joined_on',
    'ended_on',
    'suspended_at',
    'open_slot',
    'origin',
    'recorded_by',
])]
class CooperativeMembership extends Model
{
    /** @use HasFactory<CooperativeMembershipFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CooperativeMembershipStatus::class,
            'origin' => CooperativeMembershipOrigin::class,
            'joined_on' => 'date',
            'ended_on' => 'date',
            'suspended_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Cooperative, $this>
     */
    public function cooperative(): BelongsTo
    {
        return $this->belongsTo(Cooperative::class);
    }

    /**
     * @return BelongsTo<Farmer, $this>
     */
    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function isOpen(): bool
    {
        return $this->open_slot !== null;
    }
}
