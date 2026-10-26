<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'farm_insurance_id',
    'insurance_claim_id',
    'path',
    'original_name',
    'uploaded_by',
])]
class InsuranceDocument extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<FarmInsurance, $this>
     */
    public function policy(): BelongsTo
    {
        return $this->belongsTo(FarmInsurance::class, 'farm_insurance_id');
    }

    /**
     * @return BelongsTo<InsuranceClaim, $this>
     */
    public function claim(): BelongsTo
    {
        return $this->belongsTo(InsuranceClaim::class, 'insurance_claim_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
