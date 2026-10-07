<?php

namespace App\Models;

use App\BankAccountStatus;
use Database\Factories\FarmerBankAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The farmer's linked deposit account. The full account number
 * stays on the server. The profile shows only the last four digits.
 *
 * @property BankAccountStatus $status
 */
#[Fillable([
    'farmer_id',
    'bank_name',
    'account_number',
    'account_name',
    'status',
])]
class FarmerBankAccount extends Model
{
    /** @use HasFactory<FarmerBankAccountFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => BankAccountStatus::class,
        ];
    }

    /**
     * @return BelongsTo<Farmer, $this>
     */
    public function farmer(): BelongsTo
    {
        return $this->belongsTo(Farmer::class);
    }

    public function maskedAccountNumber(): string
    {
        $digits = preg_replace('/\s+/', '', $this->account_number) ?? '';
        $visible = substr($digits, -4);

        return '•••• '.$visible;
    }
}
