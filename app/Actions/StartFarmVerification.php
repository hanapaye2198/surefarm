<?php

namespace App\Actions;

use App\Contracts\VerificationReferenceGenerator;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Services\FarmAreaComparison;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StartFarmVerification
{
    public function __construct(
        private FarmAreaComparison $areas,
        private VerificationReferenceGenerator $references,
    ) {}

    /**
     * Open one verification attempt and mark the farm in progress.
     * Declared area on the farm is not changed.
     */
    public function handle(Farm $farm): FarmVerification
    {
        return DB::transaction(function () use ($farm): FarmVerification {
            $locked = Farm::query()->lockForUpdate()->findOrFail($farm->id);
            $locked->load('boundary');

            if ($locked->verification_status === FarmVerificationStatus::InProgress) {
                throw ValidationException::withMessages([
                    'verification' => 'Verification is already in progress.',
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

            $verification = $locked->verifications()->create([
                'verification_reference' => 'TMP-'.Str::uuid()->toString(),
                'previous_status' => $locked->verification_status,
                'declared_area_hectares' => $comparison['declared'],
                'measured_area_hectares' => $comparison['measured'],
                'difference_hectares' => $comparison['difference'],
                'variance_percentage' => $comparison['variance'],
            ]);

            $verification->update([
                'verification_reference' => $this->references->fromSequence($verification->id),
            ]);

            $locked->update([
                'verification_status' => FarmVerificationStatus::InProgress,
            ]);

            return $verification->refresh();
        });
    }
}
