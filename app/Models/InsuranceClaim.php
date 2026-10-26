<?php

namespace App\Models;

use App\InsuranceClaimStatus;
use App\InsuranceIncidentCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property InsuranceClaimStatus $status
 * @property InsuranceIncidentCategory $category
 * @property Carbon $incident_date
 * @property Carbon $reported_on
 * @property Carbon|null $decided_at
 * @property Carbon|null $settled_at
 * @property Carbon|null $closed_at
 */
#[Fillable([
    'farm_insurance_id',
    'incident_date',
    'reported_on',
    'category',
    'description',
    'claimed_amount',
    'currency',
    'approved_amount',
    'assessment',
    'status',
    'submitted_by',
    'decided_by',
    'decided_at',
    'rejection_reason',
    'settlement_reference',
    'settlement_amount',
    'settled_at',
    'settled_by',
    'closed_at',
    'client_token',
])]
class InsuranceClaim extends Model
{
    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'submitted',
    ];

    protected static function booted(): void
    {
        static::created(function (InsuranceClaim $claim): void {
            if ($claim->reference !== null) {
                return;
            }

            $claim->reference = sprintf('CLM-%06d', $claim->id);
            $claim->saveQuietly();
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'incident_date' => 'date',
            'reported_on' => 'date',
            'claimed_amount' => 'decimal:2',
            'approved_amount' => 'decimal:2',
            'settlement_amount' => 'decimal:2',
            'category' => InsuranceIncidentCategory::class,
            'status' => InsuranceClaimStatus::class,
            'decided_at' => 'datetime',
            'settled_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FarmInsurance, $this>
     */
    public function policy(): BelongsTo
    {
        return $this->belongsTo(FarmInsurance::class, 'farm_insurance_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return HasMany<InsuranceDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(InsuranceDocument::class);
    }
}
