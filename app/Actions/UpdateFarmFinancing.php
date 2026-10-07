<?php

namespace App\Actions;

use App\Models\FarmFinancing;

class UpdateFarmFinancing
{
    /**
     * Update one financing record. The farm it belongs to does not change.
     *
     * @param  array{amount: numeric-string, date_granted: string, loan_balance: numeric-string, financing_type: string}  $data
     */
    public function handle(FarmFinancing $financing, array $data): FarmFinancing
    {
        $financing->update([
            'amount' => $data['amount'],
            'date_granted' => $data['date_granted'],
            'loan_balance' => $data['loan_balance'],
            'financing_type' => $data['financing_type'],
        ]);

        return $financing;
    }
}
