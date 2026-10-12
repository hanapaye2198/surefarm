<?php

namespace App\Http\Controllers;

use App\FarmVerificationStatus;
use App\Http\Requests\DestroyFarmBoundaryRequest;
use App\Http\Requests\SaveFarmBoundaryRequest;
use App\Models\Farm;
use App\Services\FarmAreaComparison;
use App\Services\FarmBoundaryGeometry;
use App\UserRole;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
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
        if ($farm->boundary === null) {
            abort(404);
        }

        return $this->persist($request, $farm, $geometry, $areas, creating: false);
    }

    public function destroy(DestroyFarmBoundaryRequest $request, Farm $farm): RedirectResponse
    {
        $boundary = $farm->boundary;

        if ($boundary === null) {
            abort(404);
        }

        $boundary->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Farm boundary removed.',
        ]);

        return $request->user()?->role === UserRole::FieldVerifier
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

        $pointAccuracies = $request->validated('gps_point_accuracies');
        if (! is_array($pointAccuracies)) {
            $savedBoundary = $creating ? null : $farm->boundary;
            $pointAccuracies = $savedBoundary !== null
                && $savedBoundary->boundary_geojson == $inspection['polygon']
                    ? $savedBoundary->gps_point_accuracies
                    : null;
        }

        $attributes = [
            'boundary_geojson' => $inspection['polygon'],
            'gps_point_accuracies' => $pointAccuracies,
            'gps_measured_area_hectares' => $inspection['hectares'],
            'updated_by' => $request->user()?->id,
        ];

        try {
            DB::transaction(function () use ($creating, $farm, $attributes, $inspection, $areas, $request): void {
                $previousPolygon = $farm->boundary?->boundary_geojson;

                if ($creating) {
                    $farm->boundary()->create([
                        ...$attributes,
                        'created_by' => $request->user()?->id,
                        'captured_at' => now(),
                    ]);
                } else {
                    $farm->boundary?->update($attributes);
                }

                $farm->boundaryUpdateRequests()
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'addressed',
                        'resolved_by' => $request->user()?->id,
                        'resolved_at' => now(),
                    ]);

                if ($farm->verification_status !== FarmVerificationStatus::InProgress) {
                    return;
                }

                $openVerification = $farm->verifications()
                    ->whereNull('result')
                    ->latest('id')
                    ->first();

                if ($openVerification === null) {
                    return;
                }

                $comparison = $areas->calculate(
                    $openVerification->declared_area_hectares,
                    $inspection['hectares'],
                );
                $boundaryChanged = $previousPolygon != $inspection['polygon'];

                $openVerification->update([
                    'measured_area_hectares' => $comparison['measured'] ?? null,
                    'difference_hectares' => $comparison['difference'] ?? null,
                    'variance_percentage' => $comparison['variance'] ?? null,
                    ...($boundaryChanged ? ['inspection_checklist' => null] : []),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            return back()->withErrors([
                'boundary_geojson' => 'This farm already has a boundary.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $creating
                ? 'Farm boundary saved.'
                : 'Farm boundary updated.',
        ]);

        return $request->user()?->role === UserRole::FieldVerifier
            ? to_route('farm-verification.show', $farm)
            : to_route('farms.show', $farm);
    }
}
