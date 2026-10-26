<?php

namespace App\Models;

use App\FinancingBalanceSource;
use App\FinancingInterestMethod;
use App\FinancingRepaymentFrequency;
use App\FinancingStatus;
use App\FinancingType;
use Database\Factories\FarmFinancingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A financing grant or agreement for one farm.
 * Snapshot rows keep the balance that was typed in.
 * Ledger rows reconstruct principal, interest, and fees from transactions.
 *
 * @property FinancingType $financing_type
 * @property FinancingStatus $status
 * @property FinancingBalanceSource $balance_source
 * @property FinancingInterestMethod $interest_method
 * @property FinancingRepaymentFrequency|null $repayment_frequency
 * @property Carbon|null $date_granted
 * @property Carbon|null $application_date
 * @property Carbon|null $due_date
 * @property Carbon|null $maturity_date
 * @property Carbon|null $reviewed_at
 * @property Carbon|null $approved_at
 * @property Carbon|null $rejected_at
 * @property Carbon|null $disbursed_at
 * @property Carbon|null $completed_at
 * @property Carbon|null $defaulted_at
 * @property Carbon|null $cancelled_at
 */
#[Fillable([
    'farm_id',
    'farm_production_id',
    'submitted_by',
    'amount',
    'date_granted',
    'loan_balance',
    'financing_type',
    'purpose',
    'currency',
    'interest_method',
    'interest_rate',
    'interest_amount',
    'fee_amount',
    'application_date',
    'status',
    'balance_source',
    'reviewed_at',
    'approved_at',
    'approved_by',
    'rejected_at',
    'rejected_by',
    'rejection_reason',
    'disbursed_at',
    'disbursement_reference',
    'repayment_frequency',
    'installment_count',
    'due_date',
    'maturity_date',
    'notes',
    'completed_at',
    'defaulted_at',
    'defaulted_by',
    'default_reason',
    'cancelled_at',
    'cancelled_by',
    'client_token',
])]
class FarmFinancing extends Model
{
    /** @use HasFactory<FarmFinancingFactory> */
    use HasFactory;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'currency' => 'PHP',
        'interest_method' => 'none',
        'interest_amount' => 0,
        'fee_amount' => 0,
        'status' => 'recorded',
        'balance_source' => 'snapshot',
    ];

    protected static function booted(): void
    {
        static::created(function (FarmFinancing $financing): void {
            if ($financing->reference !== null) {
                return;
            }

            $financing->reference = sprintf('FIN-%06d', $financing->id);
            $financing->saveQuietly();
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'date_granted' => 'date',
            'loan_balance' => 'decimal:2',
            'financing_type' => FinancingType::class,
            'interest_method' => FinancingInterestMethod::class,
            'interest_rate' => 'decimal:4',
            'interest_amount' => 'decimal:2',
            'fee_amount' => 'decimal:2',
            'application_date' => 'date',
            'status' => FinancingStatus::class,
            'balance_source' => FinancingBalanceSource::class,
            'reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'disbursed_at' => 'datetime',
            'repayment_frequency' => FinancingRepaymentFrequency::class,
            'due_date' => 'date',
            'maturity_date' => 'date',
            'completed_at' => 'datetime',
            'defaulted_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        if (! $user instanceof User) {
            return $query;
        }

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
     * @return HasMany<FinancingTransaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(FinancingTransaction::class);
    }

    /**
     * @return HasMany<FinancingDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(FinancingDocument::class);
    }

    public function usesLedger(): bool
    {
        return $this->balance_source === FinancingBalanceSource::Ledger;
    }

    /**
     * @return array{
     *     id: int,
     *     reference: string,
     *     amount_label: string,
     *     date_granted: string,
     *     date_granted_input: string,
     *     loan_balance_label: string,
     *     financing_type: string,
     *     financing_type_label: string,
     *     amount: string,
     *     loan_balance: string,
     *     status: string,
     *     status_label: string,
     *     balance_source: string,
     *     balance_source_label: string
     * }
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference ?? '—',
            'amount_label' => $this->money($this->amount),
            'date_granted' => $this->date_granted?->format('m/d/Y') ?? '—',
            'date_granted_input' => $this->date_granted?->format('Y-m-d') ?? '',
            'loan_balance_label' => $this->money($this->loan_balance),
            'financing_type' => $this->financing_type->value,
            'financing_type_label' => $this->financing_type->label(),
            'amount' => $this->plainAmount($this->amount),
            'loan_balance' => $this->loan_balance === null ? '' : $this->plainAmount($this->loan_balance),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'balance_source' => $this->balance_source->value,
            'balance_source_label' => $this->balance_source->label(),
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
