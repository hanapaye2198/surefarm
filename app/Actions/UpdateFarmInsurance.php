<?php

namespace App\Actions;

use App\InsurancePolicyStatus;
use App\Models\FarmInsurance;
use Illuminate\Validation\ValidationException;

class UpdateFarmInsurance
{
    /**
     * Update one stated coverage note. The farm it belongs to does not change.
     * Policy rows are changed only through the insurance workflow.
     *
     * @param  array{covered: bool, amount?: numeric-string|null, term_months?: int|null}  $data
     */
    public function handle(FarmInsurance $insurance, array $data): FarmInsurance
    {
        if ($insurance->status !== InsurancePolicyStatus::Recorded) {
            throw ValidationException::withMessages([
                'covered' => 'This policy is managed from Crop Insurance. The stated coverage form cannot change it.',
            ]);
        }

        $covered = (bool) $data['covered'];

        $insurance->update([
            'covered' => $covered,
            'amount' => $covered ? ($data['amount'] ?? null) : null,
            'term_months' => $covered ? ($data['term_months'] ?? null) : null,
        ]);

        return $insurance;
    }
}
