<?php

namespace App\Http\Controllers;

use App\Http\Requests\DestroyFarmBoundaryRequest;
use App\Http\Requests\SaveFarmBoundaryRequest;
use App\Models\Farm;
use App\Services\FarmAreaComparison;
use App\Services\FarmBoundaryGeometry;
use App\UserRole;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
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

    public function store(SaveFarmBoundaryRequest $request, Farm $farm, FarmBoundaryGeometry $geometry): RedirectResponse
    {
        if ($farm->boundary()->exists()) {
            return back()->withErrors([
                'boundary_geojson' => 'This farm already has a boundary.',
            ]);
        }

        return $this->persist($request, $farm, $geometry, creating: true);
    }

    public function update(SaveFarmBoundaryRequest $request, Farm $farm, FarmBoundaryGeometry $geometry): RedirectResponse
    {
        if ($farm->boundary === null) {
            abort(404);
        }

        return $this->persist($request, $farm, $geometry, creating: false);
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
        bool $creating,
    ): RedirectResponse {
        $inspection = $geometry->inspect($request->validated('boundary_geojson'));

        if ($inspection['polygon'] === null) {
            return back()->withErrors([
                'boundary_geojson' => $inspection['error'],
            ]);
        }

        $attributes = [
            'boundary_geojson' => $inspection['polygon'],
            'gps_measured_area_hectares' => $inspection['hectares'],
            'updated_by' => $request->user()?->id,
        ];

        try {
            if ($creating) {
                $farm->boundary()->create([
                    ...$attributes,
                    'created_by' => $request->user()?->id,
                    'captured_at' => now(),
                ]);
            } else {
                $farm->boundary?->update($attributes);
            }
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
