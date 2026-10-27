<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'farmer_id',
    'kind',
    'status',
    'amount_minor',
    'currency',
    'provider',
    'account_name',
    'account_reference',
    'description',
    'reference',
    'review_notes',
    'processed_by',
    'provider_reference',
    'processed_at',
])]
class FarmerWalletRequest extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'account_name' => 'encrypted',
            'account_reference' => 'encrypted',
            'processed_at' => 'immutable_datetime',
        ];
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
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
