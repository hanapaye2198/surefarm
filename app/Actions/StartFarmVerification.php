<?php

namespace App\Actions;

use App\Contracts\VerificationReferenceGenerator;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Models\User;
use App\Notifications\FarmVerificationStatusNotification;
use App\Services\FarmAreaComparison;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class StartFarmVerification
{
    public function __construct(
        private FarmAreaComparison $areas,
        private VerificationReferenceGenerator $references,
    ) {}

    /**
     * Open one verification attempt. A previously saved boundary remains
     * available as reference, but every attempt needs a fresh boundary save.
     * Declared area on the farm is not changed.
     */
    public function handle(Farm $farm, User $actor, bool $mobileWorkflow = false): FarmVerification
    {
        if ($actor->isSuspended() || ! $actor->hasRole(UserRole::FieldVerifier, UserRole::Admin)) {
            abort(403);
        }

        if (! app(RegistryScope::class)->canViewFarm($actor, $farm)) {
            abort(404);
        }

        $verification = DB::transaction(function () use ($farm, $actor, $mobileWorkflow): FarmVerification {
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
                'boundary_geojson' => $locked->boundary?->boundary_geojson,
                'gps_point_accuracies' => $locked->boundary?->gps_point_accuracies,
                'gps_point_captured_at' => null,
                'boundary_capture_method' => null,
                'previous_boundary_geojson' => $locked->boundary?->boundary_geojson,
                'previous_gps_point_accuracies' => $locked->boundary?->gps_point_accuracies,
                'previous_gps_point_captured_at' => $locked->boundary?->gps_point_captured_at,
                'previous_boundary_capture_method' => $locked->boundary?->capture_method,
                'previous_boundary_captured_at' => $locked->boundary?->captured_at,
                'previous_measured_area_hectares' => $locked->boundary?->gps_measured_area_hectares,
                // Keep any prior polygon for reference, but it is not a fresh
                // capture for this verification attempt.
                'boundary_captured_at' => null,
                'boundary_captured_by' => null,
                'boundary_revision' => 0,
                'started_by' => $actor->id,
                'started_at' => now(),
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
        try {
            $farm->farmer?->user?->notify(new FarmVerificationStatusNotification(
                $farm,
                FarmVerificationStatus::InProgress->value,
                'A field verifier has started work on your farm verification.',
            ));
        } catch (Throwable $exception) {
            report($exception);
        }

        return $verification;
    }
}
