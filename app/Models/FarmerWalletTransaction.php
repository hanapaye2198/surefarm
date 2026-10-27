<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $amount_minor
 * @property string $direction
 * @property string $status
 * @property string $reference
 */
#[Fillable([
    'farmer_id',
    'direction',
    'status',
    'amount_minor',
    'currency',
    'description',
    'reference',
    'provider',
    'provider_reference',
    'occurred_at',
])]
class FarmerWalletTransaction extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'occurred_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Farmer, $this>
     */
    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }
}
