<?php

namespace App\Services;

use App\InsuranceClaimStatus;
use App\InsurancePolicyStatus;
use App\Models\FarmInsurance;
use App\Models\InsuranceClaim;
use Illuminate\Database\Eloquent\Builder;

class InsuranceSummary
{
    /**
     * @param  Builder<FarmInsurance>  $policies
     * @return array<string, mixed>
     */
    public function summarize(Builder $policies): array
    {
        $today = now()->toDateString();
        $soon = now()->addDays(30)->toDateString();
        $ids = (clone $policies)->select('farm_insurances.id');
        $managed = (clone $policies)->where('status', '!=', InsurancePolicyStatus::Recorded->value);

        $currencies = [];

        foreach ((clone $managed)->where('status', InsurancePolicyStatus::Active->value)->get(['currency', 'amount']) as $policy) {
            $currency = $policy->currency ?: 'PHP';
            $currencies[$currency]['insured_value'] = ($currencies[$currency]['insured_value'] ?? 0) + (float) $policy->amount;
        }

        $claims = InsuranceClaim::query()->whereIn('farm_insurance_id', $ids);

        foreach ((clone $claims)->where('status', InsuranceClaimStatus::Approved->value)->get(['currency', 'approved_amount']) as $claim) {
            $currency = $claim->currency ?: 'PHP';
            $currencies[$currency]['approved_claims'] = ($currencies[$currency]['approved_claims'] ?? 0) + (float) $claim->approved_amount;
        }

        foreach ((clone $claims)->whereIn('status', [InsuranceClaimStatus::Settled->value, InsuranceClaimStatus::Closed->value])->whereNotNull('settlement_amount')->get(['currency', 'settlement_amount']) as $claim) {
            $currency = $claim->currency ?: 'PHP';
            $currencies[$currency]['settled'] = ($currencies[$currency]['settled'] ?? 0) + (float) $claim->settlement_amount;
        }

        $money = [];

        foreach ($currencies as $currency => $totals) {
            $money[] = [
                'currency' => $currency,
                'insured_value' => $this->money($currency, $totals['insured_value'] ?? 0),
                'approved_claims' => $this->money($currency, $totals['approved_claims'] ?? 0),
                'settled' => $this->money($currency, $totals['settled'] ?? 0),
            ];
        }

        return [
            'recorded_count' => (clone $policies)->where('status', InsurancePolicyStatus::Recorded->value)->count(),
            'policies' => (clone $managed)->count(),
            'active' => (clone $managed)->where('status', InsurancePolicyStatus::Active->value)->count(),
            'expiring' => (clone $managed)
                ->where('status', InsurancePolicyStatus::Active->value)
                ->whereDate('coverage_end', '>=', $today)
                ->whereDate('coverage_end', '<=', $soon)
                ->count(),
            'insured_farms' => (clone $managed)->where('status', InsurancePolicyStatus::Active->value)->distinct('farm_id')->count('farm_id'),
            'open_claims' => (clone $claims)->whereIn('status', [InsuranceClaimStatus::Submitted->value, InsuranceClaimStatus::UnderReview->value])->count(),
            'claims_under_review' => (clone $claims)->where('status', InsuranceClaimStatus::UnderReview->value)->count(),
            'approved_claims' => (clone $claims)->where('status', InsuranceClaimStatus::Approved->value)->count(),
            'rejected_claims' => (clone $claims)->where('status', InsuranceClaimStatus::Rejected->value)->count(),
            'awaiting_settlement' => (clone $claims)->where('status', InsuranceClaimStatus::Approved->value)->count(),
            'currencies' => $money,
            'definitions' => [
                'Active policies are approved, activated, and not yet past the coverage end date.',
                'Stated coverage notes entered on a farm are not policies and are not included in insured value.',
                'Insured value is the amount stored on an active policy. It is not a claim or a settlement.',
                'Approved claim amount is the decision amount. Settled amount is the amount recorded as paid.',
            ],
        ];
    }

    private function money(string $currency, float $amount): string
    {
        $formatted = number_format($amount, 2);

        return $currency === 'PHP' ? '₱'.$formatted : $currency.' '.$formatted;
    }
}
