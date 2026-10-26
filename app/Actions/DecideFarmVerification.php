<?php

namespace App\Actions;

use App\CropType;
use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Models\Farm;
use App\Models\FarmVerification;
use App\Models\User;
use App\Notifications\FarmVerificationStatusNotification;
use App\Services\FarmAreaComparison;
use App\Services\FarmBoundaryGeometry;
use App\Services\RegistryScope;
use App\UserRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class DecideFarmVerification
{
    public function __construct(
        private FarmAreaComparison $areas,
        private FarmBoundaryGeometry $geometry,
    ) {}

    /**
     * Record the verifier's decision on the open attempt.
     * Declared area is never changed. Verified area is set only
     * when the result is verified, promoting the attempt's captured
     * boundary. A failed or needs-review result leaves the accepted
     * boundary and verified area in place.
     */
    public function handle(Farm $farm, User $verifier, FarmVerificationResult $result, ?string $remarks): FarmVerification
    {
        if ($verifier->isSuspended() || ! $verifier->hasRole(UserRole::FieldVerifier, UserRole::Admin)) {
            abort(403);
        }

        if (! app(RegistryScope::class)->canViewFarm($verifier, $farm)) {
            abort(404);
        }

        $verification = DB::transaction(function () use ($farm, $verifier, $result, $remarks): FarmVerification {
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

            if (! $open->hasFreshBoundaryCapture()) {
                throw ValidationException::withMessages([
                    'verification' => 'Capture and save the farm boundary during this verification before recording a result.',
                ]);
            }

            $boundary = $this->geometry->inspect($open->boundary_geojson);
            $comparison = $boundary['polygon'] === null
                ? null
                : $this->areas->calculate($open->declared_area_hectares, $boundary['hectares']);

            if ($comparison === null) {
                throw ValidationException::withMessages([
                    'verification' => 'The captured farm boundary could not be measured. Capture and save a valid GPS boundary before recording a result.',
                ]);
            }

            $hasCurrentEvidence = $open->photos()
                ->where('boundary_revision', $open->boundary_revision ?? 0)
                ->exists();

            if ($open->inspection_checklist === null || ! $hasCurrentEvidence) {
                throw ValidationException::withMessages([
                    'verification' => 'Complete the field inspection checklist and upload evidence for the saved boundary before saving a result.',
                ]);
            }

            $checklist = $open->inspection_checklist;
            // Evidence completeness comes from the uploaded, current-revision
            // photo record. Never trust a client-supplied checklist boolean.
            $checklist['required_photos_captured'] = $hasCurrentEvidence;

            if ($result === FarmVerificationResult::Verified) {
                $usesLegacyChecklist = ! $open->mobile_workflow && ! array_key_exists('farm_exists', $checklist);
                $requiredChecks = [
                    'farm_exists',
                    'location_matches',
                    'boundary_captured',
                    'area_checked',
                    'required_photos_captured',
                    'farmer_or_representative_met',
                ];

                // Complete a legacy web attempt if it was opened before the
                // unified web/mobile checklist was introduced.
                if ($usesLegacyChecklist) {
                    $requiredChecks = [
                        'farm_identified',
                        'boundary_walked',
                        'farmer_or_representative_met',
                    ];
                }

                $cropObserved = $checklist['crop_observed']
                    ?? ($locked->crop_type === CropType::Coffee
                        ? ($checklist['coffee_crop_observed'] ?? false)
                        : false);

                if (
                    collect($requiredChecks)->contains(fn (string $check): bool => ($checklist[$check] ?? false) !== true)
                    || (! $usesLegacyChecklist && $cropObserved !== true)
                ) {
                    throw ValidationException::withMessages([
                        'verification' => 'A farm cannot be marked verified while a required field check is marked No.',
                    ]);
                }
            }

            $lastVerified = $result !== FarmVerificationResult::Verified
                ? $locked->verifications()
                    ->where('result', FarmVerificationResult::Verified)
                    ->where('id', '!=', $open->id)
                    ->latest('id')
                    ->first()
                : null;
            $open->update([
                'measured_area_hectares' => $comparison['measured'],
                'difference_hectares' => $comparison['difference'],
                'variance_percentage' => $comparison['variance'],
                'inspection_checklist' => $checklist,
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
                $boundaryAttributes = [
                    'boundary_geojson' => $boundary['polygon'],
                    'gps_point_accuracies' => $open->gps_point_accuracies,
                    'gps_point_captured_at' => $open->gps_point_captured_at,
                    'capture_method' => $open->boundary_capture_method,
                    'gps_measured_area_hectares' => $comparison['measured'],
                    'captured_at' => $open->boundary_captured_at,
                    'updated_by' => $open->boundary_captured_by ?? $verifier->id,
                ];

                if ($locked->boundary === null) {
                    $locked->boundary()->create([
                        ...$boundaryAttributes,
                        'created_by' => $open->boundary_captured_by ?? $verifier->id,
                    ]);
                } else {
                    $locked->boundary->update($boundaryAttributes);
                }

                $locked->boundaryUpdateRequests()
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'addressed',
                        'resolved_by' => $verifier->id,
                        'resolved_at' => now(),
                        'updated_at' => now(),
                    ]);
                $attributes['verified_area_hectares'] = $comparison['measured'];
            } else {
                // Older deployed code copied the in-progress candidate into
                // the official row. Restore that row only when it still
                // exactly matches this attempt's candidate; new attempts keep
                // the accepted row untouched throughout the field visit.
                $savedBoundary = $locked->boundary;
                if (
                    $savedBoundary !== null
                    && $savedBoundary->boundary_geojson === $open->boundary_geojson
                ) {
                    $previous = $open->previous_boundary_geojson !== null
                        ? [
                            'boundary_geojson' => $open->previous_boundary_geojson,
                            'gps_point_accuracies' => $open->previous_gps_point_accuracies,
                            'gps_point_captured_at' => $open->previous_gps_point_captured_at,
                            'capture_method' => $open->previous_boundary_capture_method,
                            'gps_measured_area_hectares' => $open->previous_measured_area_hectares,
                            'captured_at' => $open->previous_boundary_captured_at,
                        ]
                        : ($lastVerified?->boundary_geojson !== null
                            ? [
                                'boundary_geojson' => $lastVerified->boundary_geojson,
                                'gps_point_accuracies' => $lastVerified->gps_point_accuracies,
                                'gps_point_captured_at' => $lastVerified->gps_point_captured_at,
                                'capture_method' => $lastVerified->boundary_capture_method,
                                'gps_measured_area_hectares' => $lastVerified->measured_area_hectares,
                                'captured_at' => $lastVerified->boundary_captured_at,
                            ]
                            : null);

                    if ($previous !== null) {
                        $savedBoundary->update([
                            ...$previous,
                            'updated_by' => $verifier->id,
                        ]);
                    } else {
                        $savedBoundary->delete();
                    }
                }
            }

            $locked->update($attributes);

            return $open->refresh();
        });

        $farm->loadMissing('farmer.user');
        $remarks = $this->remarks($remarks);
        $message = match ($result) {
            FarmVerificationResult::Verified => 'Your farm verification was marked verified.',
            FarmVerificationResult::Failed => 'Your farm verification needs follow-up.',
            FarmVerificationResult::NeedsReview => 'Your farm verification needs another review.',
        };

        if ($remarks !== null) {
            $message .= ' Verifier note: '.$remarks;
        }

        try {
            $farm->farmer?->user?->notify(new FarmVerificationStatusNotification(
                $farm,
                $result->value,
                $message,
            ));
        } catch (Throwable $exception) {
            report($exception);
        }

        return $verification;
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
