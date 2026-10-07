<?php

namespace App\Actions;

use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Models\User;
use App\Services\FarmAreaComparison;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DecideFarmVerification
{
    public function __construct(private FarmAreaComparison $areas) {}

    /**
     * Record the verifier's decision on the open attempt.
     * Declared area is never changed. Verified area is set only
     * when the result is verified, using the saved boundary's
     * measured area. A failed or needs-review result leaves any
     * existing verified area in place.
     */
    public function handle(Farm $farm, User $verifier, FarmVerificationResult $result, ?string $remarks): FarmVerification
    {
        return DB::transaction(function () use ($farm, $verifier, $result, $remarks): FarmVerification {
            $locked = Farm::query()->lockForUpdate()->findOrFail($farm->id);
            $locked->load('boundary');

            $open = $locked->verifications()
                ->whereNull('result')
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if ($locked->verification_status !== FarmVerificationStatus::InProgress || $open === null) {
                throw ValidationException::withMessages([
                    'verification' => 'This verification is no longer open.',
                ]);
            }

            $comparison = $this->areas->calculate(
                $locked->declared_area_hectares,
                $locked->boundary?->gps_measured_area_hectares,
            );

            if ($comparison === null) {
                throw ValidationException::withMessages([
                    'verification' => 'Farm boundary is required before verification.',
                ]);
            }

            $open->update([
                'declared_area_hectares' => $comparison['declared'],
                'measured_area_hectares' => $comparison['measured'],
                'difference_hectares' => $comparison['difference'],
                'variance_percentage' => $comparison['variance'],
                'result' => $result,
                'remarks' => $this->remarks($remarks),
                'verified_by' => $verifier->id,
                'verified_at' => now(),
            ]);

            $attributes = [
                'verification_status' => match ($result) {
                    FarmVerificationResult::Verified => FarmVerificationStatus::Verified,
                    FarmVerificationResult::Failed => FarmVerificationStatus::Failed,
                    FarmVerificationResult::NeedsReview => FarmVerificationStatus::NeedsReview,
                },
            ];

            if ($result === FarmVerificationResult::Verified) {
                $attributes['verified_area_hectares'] = $comparison['measured'];
            }

            $locked->update($attributes);

            return $open->refresh();
        });
    }

    private function remarks(?string $remarks): ?string
    {
        if ($remarks === null) {
            return null;
        }

        $trimmed = trim($remarks);

        return $trimmed === '' ? null : $trimmed;
    }
}
