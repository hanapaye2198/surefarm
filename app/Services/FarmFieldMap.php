<?php

namespace App\Services;

use App\Models\Farm;
use App\Models\FarmAreaDeclaration;
use App\Models\User;

/**
 * Neighboring field polygons and boundary warnings for one farm map.
 * Neighbors stay inside the viewer's registry scope.
 */
final class FarmFieldMap
{
    public function __construct(private FarmBoundaryOverlap $overlap) {}

    /**
     * @return array{
     *     verified_area_hectares: float|null,
     *     purok_sitio: string|null,
     *     barangay: string|null,
     *     municipality: string|null,
     *     province: string|null,
     *     area_declarations: list<array<string, mixed>>,
     *     neighbors: list<array{
     *         id: int,
     *         farm_id: string,
     *         farm_name: string,
     *         hectares: float,
     *         geojson: array<string, mixed>,
     *         overlap_percent: float|null
     *     }>,
     *     overlaps: list<array{id: int, farm_id: string, farm_name: string, percent: float}>,
     *     mismatch: array{active_hectares: float, verified_hectares: float}|null
     * }
     */
    public function review(Farm $farm, ?User $user): array
    {
        $activeRing = $this->ring($farm->boundary?->boundary_geojson);
        $neighbors = [];

        if ($user instanceof User) {
            $candidates = Farm::query()
                ->visibleTo($user)
                ->whereKeyNot($farm->id)
                ->where(function ($query) use ($farm): void {
                    $query->where('farmer_id', $farm->farmer_id);

                    if (trim((string) $farm->municipality) !== '' && trim((string) $farm->province) !== '') {
                        $query->orWhere(function ($query) use ($farm): void {
                            $query->where('municipality', $farm->municipality)
                                ->where('province', $farm->province);
                        });
                    }
                })
                ->whereHas('boundary')
                ->with('boundary:id,farm_id,boundary_geojson,gps_measured_area_hectares')
                ->get();

            foreach ($candidates as $other) {
                $ring = $this->ring($other->boundary?->boundary_geojson);

                if ($ring === null) {
                    continue;
                }

                $percent = $activeRing === null ? 0.0 : $this->overlap->percent($activeRing, $ring);
                $sameFarmer = $other->farmer_id === $farm->farmer_id;
                $near = $activeRing !== null && ($percent >= 0.5 || $this->overlap->nearby($activeRing, $ring));

                if (! $sameFarmer && ! $near) {
                    continue;
                }

                $neighbors[] = [
                    'id' => $other->id,
                    'farm_id' => $other->farm_id,
                    'farm_name' => $other->displayName(),
                    'hectares' => round((float) $other->boundary->gps_measured_area_hectares, 2),
                    'geojson' => $other->boundary->boundary_geojson,
                    'overlap_percent' => $percent >= 0.5 ? $percent : null,
                ];
            }
        }

        usort($neighbors, function (array $left, array $right): int {
            $byOverlap = ($right['overlap_percent'] ?? 0) <=> ($left['overlap_percent'] ?? 0);

            if ($byOverlap !== 0) {
                return $byOverlap;
            }

            return $left['farm_id'] <=> $right['farm_id'];
        });

        $neighbors = array_slice($neighbors, 0, 40);
        $overlaps = [];

        foreach ($neighbors as $neighbor) {
            if ($neighbor['overlap_percent'] === null) {
                continue;
            }

            $overlaps[] = [
                'id' => $neighbor['id'],
                'farm_id' => $neighbor['farm_id'],
                'farm_name' => $neighbor['farm_name'],
                'percent' => $neighbor['overlap_percent'],
            ];
        }

        return [
            'verified_area_hectares' => $farm->verified_area_hectares === null
                ? null
                : round((float) $farm->verified_area_hectares, 2),
            'purok_sitio' => $farm->purok_sitio,
            'barangay' => $farm->barangay,
            'municipality' => $farm->municipality,
            'province' => $farm->province,
            'area_declarations' => array_values($farm->areaDeclarations
                ->map(fn (FarmAreaDeclaration $declaration): array => $declaration->present())
                ->all()),
            'neighbors' => $neighbors,
            'overlaps' => $overlaps,
            'mismatch' => $this->mismatch($farm),
        ];
    }

    /**
     * @return array{active_hectares: float, verified_hectares: float}|null
     */
    private function mismatch(Farm $farm): ?array
    {
        if ($farm->boundary?->gps_measured_area_hectares === null || $farm->verified_area_hectares === null) {
            return null;
        }

        $active = round((float) $farm->boundary->gps_measured_area_hectares, 2);
        $verified = round((float) $farm->verified_area_hectares, 2);

        if (abs($active - $verified) < 0.05) {
            return null;
        }

        return [
            'active_hectares' => $active,
            'verified_hectares' => $verified,
        ];
    }

    /**
     * @return list<array{0: float, 1: float}>|null
     */
    private function ring(mixed $geojson): ?array
    {
        if (! is_array($geojson)) {
            return null;
        }

        $coordinates = $geojson['coordinates'][0] ?? null;

        if (! is_array($coordinates) || count($coordinates) < 4) {
            return null;
        }

        $ring = [];

        foreach ($coordinates as $position) {
            if (! is_array($position) || ! isset($position[0], $position[1]) || ! is_numeric($position[0]) || ! is_numeric($position[1])) {
                return null;
            }

            $ring[] = [(float) $position[0], (float) $position[1]];
        }

        return $ring;
    }
}
