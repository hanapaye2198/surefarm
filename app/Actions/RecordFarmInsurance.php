<?php

namespace App\Actions;

use App\Models\FarmInsurance;

class RecordFarmInsurance
{
    /**
     * Store crop insurance for one farm. Farm area, verification,
     * production, and support amounts stay unchanged.
     *
     * @param  array{farm_id: int, covered: bool, amount?: numeric-string|null, term_months?: int|null}  $data
     */
    public function handle(array $data): FarmInsurance
    {
        $covered = (bool) $data['covered'];

        return FarmInsurance::query()->create([
            'farm_id' => $data['farm_id'],
            'covered' => $covered,
            'amount' => $covered ? ($data['amount'] ?? null) : null,
            'term_months' => $covered ? ($data['term_months'] ?? null) : null,
        ]);
    }
}
