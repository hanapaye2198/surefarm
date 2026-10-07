<?php

namespace App\Models;

use Database\Factories\FarmInsuranceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property bool $covered
 */
#[Fillable([
    'farm_id',
    'covered',
    'amount',
    'term_months',
])]
class FarmInsurance extends Model
{
    /** @use HasFactory<FarmInsuranceFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'covered' => 'boolean',
            'amount' => 'decimal:2',
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
     *     covered: bool,
     *     covered_label: string,
     *     amount_label: string,
     *     term_label: string,
     *     amount: string,
     *     term_months: string
     * }
     */
    public function present(): array
    {
        $months = $this->term_months === null ? null : (int) $this->term_months;

        return [
            'id' => $this->id,
            'covered' => $this->covered,
            'covered_label' => $this->covered ? 'Yes' : 'No',
            'amount_label' => $this->covered ? $this->peso($this->amount) : '—',
            'term_label' => $this->covered && $months !== null
                ? $months.' '.($months === 1 ? 'month' : 'months')
                : '—',
            'amount' => $this->amount === null ? '' : $this->plainAmount($this->amount),
            'term_months' => $months === null ? '' : (string) $months,
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
