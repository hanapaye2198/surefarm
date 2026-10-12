<?php

namespace App\Actions;

use App\Contracts\VerificationReferenceGenerator;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Notifications\FarmVerificationStatusNotification;
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
        $verification = DB::transaction(function () use ($farm): FarmVerification {
            $locked = Farm::query()->lockForUpdate()->findOrFail($farm->id);
            $locked->load('boundary');

            if (! in_array($locked->verification_status, [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::NeedsReview,
            ], true)) {
                throw ValidationException::withMessages([
                    'verification' => 'Only pending or needs-review farms can start a new verification.',
                ]);
            }

            $comparison = $this->areas->calculate(
                $locked->declared_area_hectares,
                $locked->boundary?->gps_measured_area_hectares,
            );

            $verification = $locked->verifications()->create([
                'verification_reference' => 'TMP-'.Str::uuid()->toString(),
                'previous_status' => $locked->verification_status,
                'declared_area_hectares' => (float) $locked->declared_area_hectares,
                'measured_area_hectares' => $comparison['measured'] ?? null,
                'difference_hectares' => $comparison['difference'] ?? null,
                'variance_percentage' => $comparison['variance'] ?? null,
            ]);

            $verification->update([
                'verification_reference' => $this->references->fromSequence($verification->id),
            ]);

            $locked->update([
                'verification_status' => FarmVerificationStatus::InProgress,
            ]);

            return $verification->refresh();
        });

        $farm->loadMissing('farmer.user');
        $farm->farmer?->user?->notify(new FarmVerificationStatusNotification(
            $farm,
            FarmVerificationStatus::InProgress->value,
            'A field verifier has started work on your farm verification.',
        ));

        return $verification;
    }
}
