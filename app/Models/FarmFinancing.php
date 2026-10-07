<?php

namespace App\Models;

use App\FinancingType;
use Database\Factories\FarmFinancingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property FinancingType $financing_type
 * @property Carbon $date_granted
 */
#[Fillable([
    'farm_id',
    'amount',
    'date_granted',
    'loan_balance',
    'financing_type',
])]
class FarmFinancing extends Model
{
    /** @use HasFactory<FarmFinancingFactory> */
    use HasFactory;

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
        ];
    }

    /**
     * @return BelongsTo<Farm, $this>
     */
    public function farm(): BelongsTo
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * @return array{
     *     id: int,
     *     amount_label: string,
     *     date_granted: string,
     *     date_granted_input: string,
     *     loan_balance_label: string,
     *     financing_type: string,
     *     financing_type_label: string,
     *     amount: string,
     *     loan_balance: string
     * }
     */
    public function present(): array
    {
        return [
            'id' => $this->id,
            'amount_label' => $this->peso($this->amount),
            'date_granted' => $this->date_granted->format('m/d/Y'),
            'date_granted_input' => $this->date_granted->format('Y-m-d'),
            'loan_balance_label' => $this->peso($this->loan_balance),
            'financing_type' => $this->financing_type->value,
            'financing_type_label' => $this->financing_type->label(),
            'amount' => $this->plainAmount($this->amount),
            'loan_balance' => $this->plainAmount($this->loan_balance),
        ];
    }

    private function peso(?string $amount): string
    {
        if ($amount === null) {
            return '—';
        }

        return '₱'.number_format((float) $amount, 2);
    }

    private function plainAmount(string $amount): string
    {
        return rtrim(rtrim(number_format((float) $amount, 2, '.', ''), '0'), '.');
    }
}
