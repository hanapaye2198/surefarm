<?php

namespace App\Http\Controllers;

use App\FarmVerificationResult;
use App\FarmVerificationStatus;
use App\Http\Requests\DestroyFarmBoundaryRequest;
use App\Http\Requests\SaveFarmBoundaryRequest;
use App\Models\Farm;
use App\Services\FarmAreaComparison;
use App\Services\FarmBoundaryGeometry;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class FarmBoundaryController extends Controller
{
    public function preview(SaveFarmBoundaryRequest $request, Farm $farm, FarmBoundaryGeometry $geometry, FarmAreaComparison $areas): JsonResponse
    {
        $inspection = $geometry->inspect($request->validated('boundary_geojson'));
        $hectares = $inspection['hectares'];

        if ($hectares === null) {
            return response()->json([
                'message' => $inspection['error'] ?? 'The boundary could not be measured.',
            ], 422);
        }

        return response()->json([
            'measured_area_hectares' => $hectares,
            'measured_area' => $areas->hectares($hectares),
        ]);
    }

    public function store(SaveFarmBoundaryRequest $request, Farm $farm, FarmBoundaryGeometry $geometry, FarmAreaComparison $areas): RedirectResponse
    {
        if ($farm->boundary()->exists()) {
            return back()->withErrors([
                'boundary_geojson' => 'This farm already has a boundary.',
            ]);
        }

        return $this->persist($request, $farm, $geometry, $areas, creating: true);
    }

    public function update(SaveFarmBoundaryRequest $request, Farm $farm, FarmBoundaryGeometry $geometry, FarmAreaComparison $areas): RedirectResponse
    {
        $hasOpenCandidate = $farm->verification_status === FarmVerificationStatus::InProgress
            && $farm->verifications()
                ->whereNull('result')
                ->where('boundary_revision', '>', 0)
                ->exists();

        if ($farm->boundary === null && ! $hasOpenCandidate) {
            abort(404);
        }

        return $this->persist($request, $farm, $geometry, $areas, creating: false);
    }

    public function destroy(DestroyFarmBoundaryRequest $request, Farm $farm): RedirectResponse
    {
        DB::transaction(function () use ($farm): void {
            $lockedFarm = Farm::query()->lockForUpdate()->findOrFail($farm->id);

            if (
                $lockedFarm->verification_status === FarmVerificationStatus::InProgress
                || $this->hasVerifiedBoundary($lockedFarm)
            ) {
                throw ValidationException::withMessages([
                    'boundary_geojson' => 'A verified or active verification boundary cannot be removed. Start a new verification to record a replacement boundary.',
                ]);
            }

            $boundary = $lockedFarm->boundary()->first();

            if ($boundary === null) {
                abort(404);
            }

            $boundary->delete();
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm boundary removed.',
        ]);

        return $farm->verification_status === FarmVerificationStatus::InProgress
            ? to_route('farm-verification.show', $farm)
            : to_route('farms.show', $farm);
    }

    private function persist(
        SaveFarmBoundaryRequest $request,
        Farm $farm,
        FarmBoundaryGeometry $geometry,
        FarmAreaComparison $areas,
        bool $creating,
    ): RedirectResponse {
        $inspection = $geometry->inspect($request->validated('boundary_geojson'));

        if ($inspection['polygon'] === null) {
            return back()->withErrors([
                'boundary_geojson' => $inspection['error'],
            ]);
        }

        try {
            DB::transaction(function () use ($creating, $farm, $inspection, $areas, $request): void {
                $lockedFarm = Farm::query()->lockForUpdate()->findOrFail($farm->id);
                $savedBoundary = $lockedFarm->boundary()->first();

                if (
                    $this->hasVerifiedBoundary($lockedFarm)
                    && $lockedFarm->verification_status !== FarmVerificationStatus::InProgress
                ) {
                    throw ValidationException::withMessages([
                        'boundary_geojson' => 'A verified boundary is protected. Start a new farm verification before recording a replacement boundary.',
                    ]);
                }

                $openVerification = null;
                if ($lockedFarm->verification_status === FarmVerificationStatus::InProgress) {
                    $openVerification = $lockedFarm->verifications()
                        ->whereNull('result')
                        ->lockForUpdate()
                        ->latest('id')
                        ->first();

                    if ($openVerification === null) {
                        throw ValidationException::withMessages([
                            'verification' => 'Start a new verification before changing this farm boundary.',
                        ]);
                    }
                }

                if ($openVerification === null) {
                    if ($creating && $savedBoundary !== null) {
                        throw ValidationException::withMessages([
                            'boundary_geojson' => 'This farm already has a boundary.',
                        ]);
                    }

                    if (! $creating && $savedBoundary === null) {
                        abort(404);
                    }
                } elseif (
                    ($creating && ($savedBoundary !== null || (int) $openVerification->boundary_revision > 0))
                    || (! $creating && $savedBoundary === null && (int) $openVerification->boundary_revision === 0)
                ) {
                    throw ValidationException::withMessages([
                        'boundary_geojson' => 'Reload the verification and use the boundary action shown for the current attempt.',
                    ]);
                }

                $pointAccuracies = $request->validated('gps_point_accuracies');
                $pointCapturedAt = $request->validated('gps_point_captured_at');
                $captureMethod = $request->validated('capture_method')
                    ?? (is_array($pointCapturedAt) ? 'device_gps' : null);
                $capturedAt = now();

                if ($openVerification !== null && $captureMethod !== 'device_gps') {
                    throw ValidationException::withMessages([
                        'capture_method' => 'An active verification requires a fresh GPS boundary captured in the field verifier mobile app.',
                    ]);
                }

                $attributes = [
                    'boundary_geojson' => $inspection['polygon'],
                    'gps_point_accuracies' => $pointAccuracies,
                    'gps_point_captured_at' => $pointCapturedAt,
                    'capture_method' => $captureMethod,
                    'gps_measured_area_hectares' => $inspection['hectares'],
                    'captured_at' => $capturedAt,
                    'updated_by' => $request->user()?->id,
                ];

                if ($openVerification === null) {
                    if ($creating) {
                        $lockedFarm->boundary()->create([
                            ...$attributes,
                            'created_by' => $request->user()?->id,
                            'captured_at' => $capturedAt,
                        ]);
                    } else {
                        $savedBoundary?->update($attributes);
                    }

                    return;
                }

                $comparison = $areas->calculate(
                    $openVerification->declared_area_hectares,
                    $inspection['hectares'],
                );
                $openVerification->update([
                    'measured_area_hectares' => $comparison['measured'] ?? null,
                    'difference_hectares' => $comparison['difference'] ?? null,
                    'variance_percentage' => $comparison['variance'] ?? null,
                    'boundary_geojson' => $inspection['polygon'],
                    'gps_point_accuracies' => $pointAccuracies,
                    'gps_point_captured_at' => $pointCapturedAt,
                    'boundary_capture_method' => $captureMethod,
                    'boundary_captured_at' => $capturedAt,
                    'boundary_captured_by' => $request->user()?->id,
                    'boundary_revision' => ((int) $openVerification->boundary_revision) + 1,
                    'started_at' => $openVerification->started_at ?? $capturedAt,
                    'inspection_checklist' => null,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            return back()->withErrors([
                'boundary_geojson' => 'This farm already has a boundary.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $farm->verification_status === FarmVerificationStatus::InProgress
                ? 'GPS boundary saved for this verification.'
                : ($creating ? 'Farm boundary saved.' : 'Farm boundary updated.'),
        ]);

        return $farm->verification_status === FarmVerificationStatus::InProgress
            ? to_route('farm-verification.show', $farm)
            : to_route('farms.show', $farm);
    }

    private function hasVerifiedBoundary(Farm $farm): bool
    {
        return $farm->verification_status === FarmVerificationStatus::Verified
            || $farm->verified_area_hectares !== null
            || $farm->verifications()
                ->where('result', FarmVerificationResult::Verified)
                ->exists();
    }
}
