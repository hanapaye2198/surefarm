<?php

namespace App\Http\Controllers;

use App\Http\Requests\DestroyFarmBoundaryRequest;
use App\Http\Requests\SaveFarmBoundaryRequest;
use App\Models\Farm;
use App\Services\FarmBoundaryGeometry;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class FarmBoundaryController extends Controller
{
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

        return to_route('farms.show', $farm);
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

        return to_route('farms.show', $farm);
    }
}
