<?php

namespace App\Models;

use App\AccessEventAction;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Append-only access history. The application does not update these rows.
 *
 * @property AccessEventAction $action
 * @property array<string, scalar|null>|null $metadata
 * @property Carbon $created_at
 */
#[Fillable([
    'actor_id',
    'subject_user_id',
    'action',
    'auditable_type',
    'auditable_id',
    'metadata',
    'created_at',
])]
class AccessEvent extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action' => AccessEventAction::class,
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function subject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subject_user_id');
    }
}
