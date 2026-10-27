<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $amount_minor
 * @property string $direction
 * @property string $status
 * @property bool $is_demo
 * @property string $reference
 * @property CarbonImmutable|null $occurred_at
 */
#[Fillable([
    'farmer_id',
    'direction',
    'status',
    'is_demo',
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
            'is_demo' => 'boolean',
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
