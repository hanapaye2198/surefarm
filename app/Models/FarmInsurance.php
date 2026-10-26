<?php

namespace App\Models;

use App\InsurancePolicyStatus;
use Database\Factories\FarmInsuranceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A stated coverage note or a crop insurance policy for one farm.
 * Recorded rows keep the covered flag entered on the farm.
 * Policy rows follow review, approval, activation, and expiry.
 *
 * @property InsurancePolicyStatus $status
 * @property bool $covered
 * @property Carbon|null $coverage_start
 * @property Carbon|null $coverage_end
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $approved_at
 * @property Carbon|null $rejected_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $activated_at
 */
#[Fillable([
    'farm_id',
    'farm_production_id',
    'submitted_by',
    'covered',
    'amount',
    'term_months',
    'provider',
    'policy_type',
    'currency',
    'insured_area',
    'premium_amount',
    'coverage_start',
    'coverage_end',
    'terms',
    'exclusions',
    'status',
    'reviewed_at',
    'approved_at',
    'approved_by',
    'rejected_at',
    'rejected_by',
    'rejection_reason',
    'cancelled_at',
    'cancelled_by',
    'activated_at',
    'notes',
    'client_token',
])]
class FarmInsurance extends Model
{
    /** @use HasFactory<FarmInsuranceFactory> */
    use HasFactory;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'currency' => 'PHP',
        'premium_amount' => 0,
        'status' => 'recorded',
    ];

    protected static function booted(): void
    {
        static::created(function (FarmInsurance $insurance): void {
            if ($insurance->reference !== null) {
                return;
            }

            $insurance->reference = sprintf('INS-%06d', $insurance->id);
            $insurance->saveQuietly();
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'covered' => 'boolean',
            'amount' => 'decimal:2',
            'insured_area' => 'decimal:2',
            'premium_amount' => 'decimal:2',
            'coverage_start' => 'date',
            'coverage_end' => 'date',
            'status' => InsurancePolicyStatus::class,
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'activated_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<FarmInsurance>  $query
     * @return Builder<FarmInsurance>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->whereHas('farm', fn (Builder $farm) => $farm->visibleTo($user));
    }

    /**
     * @return BelongsTo<Farm, $this>
     */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * @return BelongsTo<FarmProduction, $this>
     */
    public function production(): BelongsTo
    {
        return $this->belongsTo(FarmProduction::class, 'farm_production_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return HasMany<InsuranceClaim, $this>
     */
    public function claims(): HasMany
    {
        return $this->hasMany(InsuranceClaim::class);
    }

    /**
     * @return HasMany<InsuranceDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(InsuranceDocument::class);
    }

    public function isRecordedNote(): bool
    {
        return $this->status === InsurancePolicyStatus::Recorded;
    }

    public function coversDate(mixed $date): bool
    {
        if ($this->coverage_start === null || $this->coverage_end === null) {
            return false;
        }

        $day = Carbon::parse($date)->startOfDay();

        return $day->greaterThanOrEqualTo($this->coverage_start->startOfDay())
            && $day->lessThanOrEqualTo($this->coverage_end->startOfDay());
    }

    /**
     * @return array{
     *     id: int,
     *     covered: bool,
     *     covered_label: string,
     *     amount_label: string,
     *     term_label: string,
     *     amount: string,
     *     term_months: string,
     *     reference: string,
     *     status: string,
     *     status_label: string
     * }
     */
    public function present(): array
    {
        $months = $this->term_months === null ? null : (int) $this->term_months;

        return [
            'id' => $this->id,
            'covered' => $this->covered,
            'covered_label' => $this->covered ? 'Yes' : 'No',
            'amount_label' => $this->covered ? $this->money($this->amount) : '—',
            'term_label' => $this->covered && $months !== null
                ? $months.' '.($months === 1 ? 'month' : 'months')
                : '—',
            'amount' => $this->amount === null ? '' : $this->plainAmount($this->amount),
            'term_months' => $months === null ? '' : (string) $months,
            'reference' => $this->reference ?? '—',
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
        ];
    }

    public function money(float|int|string|null $amount): string
    {
        if ($amount === null || $amount === '') {
            return '—';
        }

        $formatted = number_format((float) $amount, 2);
        $currency = $this->currency ?: 'PHP';

        return $currency === 'PHP' ? '₱'.$formatted : $currency.' '.$formatted;
    }

    private function plainAmount(float|int|string $amount): string
    {
        return rtrim(rtrim(number_format((float) $amount, 2, '.', ''), '0'), '.');
    }
}
