<?php

namespace App\Models;

use App\RegistryGrantKind;
use Database\Factories\RegistryGrantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property RegistryGrantKind $kind
 * @property Carbon|null $revoked_at
 */
#[Fillable([
    'user_id',
    'kind',
    'province',
    'granted_by',
    'revoked_at',
])]
class RegistryGrant extends Model
{
    /** @use HasFactory<RegistryGrantFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => RegistryGrantKind::class,
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
    public function grantor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by');
    }

    public function isOpen(): bool
    {
        return $this->revoked_at === null;
    }
}
