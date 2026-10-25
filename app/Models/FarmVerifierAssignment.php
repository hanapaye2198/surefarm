<?php

namespace App\Models;

use Database\Factories\FarmVerifierAssignmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon $assigned_at
 * @property Carbon|null $scheduled_for
 * @property Carbon|null $revoked_at
 */
#[Fillable([
    'user_id',
    'farm_id',
    'assigned_by',
    'assigned_at',
    'scheduled_for',
    'revoked_at',
])]
class FarmVerifierAssignment extends Model
{
    /** @use HasFactory<FarmVerifierAssignmentFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'scheduled_for' => 'date',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    /**
     * @return BelongsTo<Farm, $this>
     */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    public function isOpen(): bool
    {
        return $this->revoked_at === null;
    }
}
