<?php

namespace App\Services;

/**
 * Approximate geodesic area of a polygon on a sphere.
 *
 * Uses the spherical excess method described by Chamberlain and Duquette
 * in "Some Algorithms for Polygons on a Sphere" (JPL Publication 07-03),
 * with the WGS84 equatorial radius of 6,378,137 meters. The same method
 * is used by the web map preview. It is suitable for this demo and is
 * not a surveyed cadastral measurement.
 */
final class SphericalPolygonArea
{
    private const EARTH_RADIUS_METERS = 6378137.0;

    /**
     * @param  list<array{0: float, 1: float}>  $ring  Closed GeoJSON ring of [longitude, latitude]
     */
    public function hectares(array $ring): float
    {
        return round(abs($this->squareMeters($ring)) / 10000, 2);
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     */
    public function squareMeters(array $ring): float
    {
        $count = count($ring);
        $area = 0.0;

        if ($count <= 2) {
            return 0.0;
        }

        for ($index = 0; $index < $count; $index++) {
            if ($index === $count - 2) {
                $lower = $count - 2;
                $middle = $count - 1;
                $upper = 0;
            } elseif ($index === $count - 1) {
                $lower = $count - 1;
                $middle = 0;
                $upper = 1;
            } else {
                $lower = $index;
                $middle = $index + 1;
                $upper = $index + 2;
            }

            $area += ($this->radians($ring[$upper][0]) - $this->radians($ring[$lower][0]))
                * sin($this->radians($ring[$middle][1]));
        }

        return $area * self::EARTH_RADIUS_METERS * self::EARTH_RADIUS_METERS / 2;
    }

    private function radians(float $degrees): float
    {
        return $degrees * M_PI / 180;
    }
}
