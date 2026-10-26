<?php

namespace App\Actions;

use App\Models\FarmFinancing;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateFarmFinancing
{
    /**
     * Update one stated financing grant. Ledger agreements keep their
     * posted amounts and are changed only through the finance ledger.
     *
     * @param  array{amount: numeric-string, date_granted: string, loan_balance: numeric-string, financing_type: string}  $data
     */
    public function handle(FarmFinancing $financing, array $data): FarmFinancing
    {
        return DB::transaction(function () use ($financing, $data): FarmFinancing {
            $locked = FarmFinancing::query()->whereKey($financing->id)->lockForUpdate()->firstOrFail();

            if ($locked->usesLedger()) {
                throw ValidationException::withMessages([
                    'amount' => 'This agreement is managed from the finance ledger. Posted amounts cannot be edited here.',
                ]);
            }

            $locked->update([
                'amount' => $data['amount'],
                'date_granted' => $data['date_granted'],
                'loan_balance' => $data['loan_balance'],
                'financing_type' => $data['financing_type'],
            ]);

            return $locked;
        });
    }
}
