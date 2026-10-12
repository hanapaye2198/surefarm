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
     * Open one verification attempt. The mobile workflow may begin before
     * boundary capture; the established web workflow still requires a boundary.
     * Declared area on the farm is not changed.
     */
    public function handle(Farm $farm, bool $mobileWorkflow = false): FarmVerification
    {
        $verification = DB::transaction(function () use ($farm, $mobileWorkflow): FarmVerification {
            $locked = Farm::query()->lockForUpdate()->findOrFail($farm->id);
            $locked->load('boundary');

            if (! in_array($locked->verification_status, [
                FarmVerificationStatus::Pending,
                FarmVerificationStatus::NeedsReview,
                FarmVerificationStatus::Failed,
                FarmVerificationStatus::Verified,
            ], true)) {
                throw ValidationException::withMessages([
                    'verification' => 'This farm cannot start another verification in its current status.',
                ]);
            }

            if (! $mobileWorkflow && $locked->boundary === null) {
                throw ValidationException::withMessages([
                    'verification' => 'Farm boundary is required before verification.',
                ]);
            }

            $comparison = $locked->boundary === null
                ? null
                : $this->areas->calculate(
                    $locked->declared_area_hectares,
                    $locked->boundary->gps_measured_area_hectares,
                );

            $verification = $locked->verifications()->create([
                'verification_reference' => 'TMP-'.Str::uuid()->toString(),
                'previous_status' => $locked->verification_status,
                'declared_area_hectares' => (float) $locked->declared_area_hectares,
                'measured_area_hectares' => $comparison['measured'] ?? null,
                'difference_hectares' => $comparison['difference'] ?? null,
                'variance_percentage' => $comparison['variance'] ?? null,
                'mobile_workflow' => $mobileWorkflow,
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
