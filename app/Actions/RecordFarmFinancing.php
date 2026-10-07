<?php

namespace App\Actions;

use App\Models\FarmFinancing;

class RecordFarmFinancing
{
    /**
     * Store a financing grant for one farm. Support amounts and
     * accounting totals are left unchanged.
     *
     * @param  array{farm_id: int, amount: numeric-string, date_granted: string, loan_balance: numeric-string, financing_type: string}  $data
     */
    public function handle(array $data): FarmFinancing
    {
        return FarmFinancing::query()->create([
            'farm_id' => $data['farm_id'],
            'amount' => $data['amount'],
            'date_granted' => $data['date_granted'],
            'loan_balance' => $data['loan_balance'],
            'financing_type' => $data['financing_type'],
        ]);
    }
}
