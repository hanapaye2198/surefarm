<?php

namespace App\Actions;

use App\Models\FarmInsurance;

class UpdateFarmInsurance
{
    /**
     * Update one insurance record. The farm it belongs to does not change.
     *
     * @param  array{covered: bool, amount?: numeric-string|null, term_months?: int|null}  $data
     */
    public function handle(FarmInsurance $insurance, array $data): FarmInsurance
    {
        $covered = (bool) $data['covered'];

        $insurance->update([
            'covered' => $covered,
            'amount' => $covered ? ($data['amount'] ?? null) : null,
            'term_months' => $covered ? ($data['term_months'] ?? null) : null,
        ]);

        return $insurance;
    }
}
