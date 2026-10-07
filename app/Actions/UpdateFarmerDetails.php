<?php

namespace App\Actions;

use App\BankAccountStatus;
use App\Models\Farmer;
use Illuminate\Support\Facades\DB;

class UpdateFarmerDetails
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Farmer $farmer, array $data): Farmer
    {
        return DB::transaction(function () use ($farmer, $data): Farmer {
            $farmer->update([
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'government_id' => $data['government_id'] ?? null,
            ]);

            $hasBankAccount = filter_var($data['has_bank_account'] ?? false, FILTER_VALIDATE_BOOLEAN);

            if ($hasBankAccount) {
                $farmer->bankAccount()->updateOrCreate(
                    ['farmer_id' => $farmer->id],
                    [
                        'bank_name' => $data['bank_name'],
                        'account_number' => $data['account_number'],
                        'account_name' => $data['account_name'],
                        'status' => $data['bank_account_status'] ?? BankAccountStatus::Unverified,
                    ],
                );
            } else {
                $farmer->bankAccount()->delete();
            }

            return $farmer->load('bankAccount');
        });
    }
}
