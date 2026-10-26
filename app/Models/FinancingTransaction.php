<?php

namespace App\Models;

use App\FinancingComponent;
use App\FinancingDirection;
use App\FinancingReconciliationStatus;
use App\FinancingTransactionType;
use Database\Factories\FinancingTransactionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * One posted financing movement. Amount, type, and direction stay as posted.
 * Reconciliation is the only in-place change, and it does not alter the amount.
 *
 * @property FinancingTransactionType $type
 * @property FinancingComponent $component
 * @property FinancingDirection $direction
 * @property FinancingReconciliationStatus $reconciliation_status
 * @property Carbon $occurred_on
 * @property Carbon|null $reconciled_at
 * @property Carbon $created_at
 */
#[Fillable([
    'farm_financing_id',
    'group_reference',
    'type',
    'amount',
    'currency',
    'component',
    'direction',
    'occurred_on',
    'payment_method',
    'external_reference',
    'reconciliation_status',
    'reconciled_at',
    'reconciled_by',
    'recorded_by',
    'reverses_transaction_id',
    'idempotency_key',
    'notes',
])]
class FinancingTransaction extends Model
{
    /** @use HasFactory<FinancingTransactionFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'reconciliation_status' => 'recorded',
    ];

    protected static function booted(): void
    {
        static::created(function (FinancingTransaction $transaction): void {
            if ($transaction->reference !== null) {
                return;
            }

            $transaction->reference = sprintf('TXN-%06d', $transaction->id);
            $transaction->saveQuietly();
        });

        static::updating(function (FinancingTransaction $transaction): void {
            $allowed = ['reconciliation_status', 'reconciled_at', 'reconciled_by'];

            if ($transaction->getOriginal('reference') === null) {
                $allowed[] = 'reference';
            }

            $unexpected = array_diff(array_keys($transaction->getDirty()), $allowed);

            if ($unexpected !== []) {
                throw new RuntimeException('Posted financing transactions cannot be rewritten.');
            }
        });

        static::deleting(function (): bool {
            return false;
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'type' => FinancingTransactionType::class,
            'component' => FinancingComponent::class,
            'direction' => FinancingDirection::class,
            'occurred_on' => 'date',
            'reconciliation_status' => FinancingReconciliationStatus::class,
            'reconciled_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FarmFinancing, $this>
     */
    public function financing(): BelongsTo
    {
        return $this->belongsTo(FarmFinancing::class, 'farm_financing_id');
    }

    /**
     * @return BelongsTo<FinancingTransaction, $this>
     */
    public function reversedTransaction(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_transaction_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reconciler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }
}
