<?php

namespace App\Actions;

use App\FinancingBalanceSource;
use App\FinancingStatus;
use App\Models\FarmFinancing;
use Illuminate\Support\Facades\DB;

class RecordFarmFinancing
{
    /**
     * Store a stated financing grant for one farm. This does not create
     * ledger transactions, and support amounts stay unchanged.
     *
     * @param  array{farm_id: int, amount: numeric-string, date_granted: string, loan_balance: numeric-string, financing_type: string}  $data
     */
    public function handle(array $data): FarmFinancing
    {
        return DB::transaction(fn (): FarmFinancing => FarmFinancing::query()->create([
            'farm_id' => $data['farm_id'],
            'amount' => $data['amount'],
            'date_granted' => $data['date_granted'],
            'loan_balance' => $data['loan_balance'],
            'financing_type' => $data['financing_type'],
            'currency' => 'PHP',
            'status' => FinancingStatus::Recorded,
            'balance_source' => FinancingBalanceSource::Snapshot,
        ]));
    }
}
