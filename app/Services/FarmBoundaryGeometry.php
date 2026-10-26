<?php

namespace App\Services;

/**
 * GeoJSON positions are [longitude, latitude]. A farm boundary is one
 * closed polygon ring. Declared area and verification status are not
 * derived from this geometry.
 */
final class FarmBoundaryGeometry
{
    public function __construct(private SphericalPolygonArea $area) {}

    public function message(mixed $value): ?string
    {
        return $this->inspect($value)['error'];
    }

    /**
     * @return array{polygon: array{type: 'Polygon', coordinates: list<list<array{0: float, 1: float}>>}, hectares: float, error: null}|array{polygon: null, hectares: null, error: string}
     */
    public function inspect(mixed $value): array
    {
        if (! is_array($value)) {
            return $this->invalid('Enter a polygon boundary.');
        }

        if (($value['type'] ?? null) !== 'Polygon') {
            return $this->invalid('The boundary must be a polygon.');
        }

        $coordinates = $value['coordinates'] ?? null;

        if (! is_array($coordinates) || ! is_array($coordinates[0] ?? null)) {
            return $this->invalid('The boundary needs a coordinate ring.');
        }

        if (count($coordinates) !== 1) {
            return $this->invalid('The boundary must be a single polygon ring.');
        }

        /** @var list<mixed> $ring */
        $ring = array_values($coordinates[0]);

        if (count($ring) < 4) {
            return $this->invalid('The boundary needs at least three points.');
        }

        $normalized = [];

        foreach ($ring as $position) {
            $point = $this->position($position);

            if (is_string($point)) {
                return $this->invalid($point);
            }

            $normalized[] = $point;
        }

        $first = $normalized[0];
        $last = $normalized[array_key_last($normalized)];

        if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
            return $this->invalid('Close the boundary by repeating the first point at the end.');
        }

        $vertices = array_slice($normalized, 0, -1);

        if (count(array_unique(array_map('serialize', $vertices))) < 3) {
            return $this->invalid('The boundary needs at least three distinct points.');
        }

        for ($index = 0, $count = count($vertices); $index < $count; $index++) {
            $next = ($index + 1) % $count;

            if ($vertices[$index] === $vertices[$next]) {
                return $this->invalid('The boundary cannot repeat adjacent points.');
            }
        }

        if ($this->hasSelfIntersection($vertices)) {
            return $this->invalid('The boundary crosses itself. Recheck the GPS point order and try again.');
        }

        $hectares = $this->area->hectares($normalized);

        if ($hectares <= 0) {
            return $this->invalid('The boundary must enclose an area.');
        }

        return [
            'polygon' => [
                'type' => 'Polygon',
                'coordinates' => [$normalized],
            ],
            'hectares' => $hectares,
            'error' => null,
        ];
    }

    /**
     * @return array{0: float, 1: float}|string
     */
    private function position(mixed $position): array|string
    {
        if (! is_array($position) || count($position) !== 2 || ! array_is_list($position)) {
            return 'Each boundary point must be a longitude and latitude.';
        }

        if (! is_numeric($position[0]) || ! is_finite((float) $position[0])) {
            return 'Enter a valid longitude.';
        }

        if (! is_numeric($position[1]) || ! is_finite((float) $position[1])) {
            return 'Enter a valid latitude.';
        }

        $longitude = round((float) $position[0], 7);
        $latitude = round((float) $position[1], 7);

        if ($longitude < -180 || $longitude > 180) {
            return 'Longitude must be between -180 and 180.';
        }

        if ($latitude < -90 || $latitude > 90) {
            return 'Latitude must be between -90 and 90.';
        }

        return [$longitude, $latitude];
    }

    /**
     * @param  list<array{0: float, 1: float}>  $vertices  An open ring without its repeated closing point.
     */
    private function hasSelfIntersection(array $vertices): bool
    {
        $count = count($vertices);

        for ($firstIndex = 0; $firstIndex < $count; $firstIndex++) {
            $firstStart = $vertices[$firstIndex];
            $firstEnd = $vertices[($firstIndex + 1) % $count];

            for ($secondIndex = $firstIndex + 1; $secondIndex < $count; $secondIndex++) {
                // Neighboring edges meet at a normal polygon vertex.
                if ($secondIndex === $firstIndex + 1 || ($firstIndex === 0 && $secondIndex === $count - 1)) {
                    continue;
                }

                $secondStart = $vertices[$secondIndex];
                $secondEnd = $vertices[($secondIndex + 1) % $count];

                if ($this->segmentsIntersect($firstStart, $firstEnd, $secondStart, $secondEnd)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  array{0: float, 1: float}  $a
     * @param  array{0: float, 1: float}  $b
     * @param  array{0: float, 1: float}  $c
     * @param  array{0: float, 1: float}  $d
     */
    private function segmentsIntersect(array $a, array $b, array $c, array $d): bool
    {
        $epsilon = 1.0e-12;
        $abC = $this->orientation($a, $b, $c);
        $abD = $this->orientation($a, $b, $d);
        $cdA = $this->orientation($c, $d, $a);
        $cdB = $this->orientation($c, $d, $b);

        if (($abC > $epsilon && $abD < -$epsilon || $abC < -$epsilon && $abD > $epsilon)
            && ($cdA > $epsilon && $cdB < -$epsilon || $cdA < -$epsilon && $cdB > $epsilon)) {
            return true;
        }

        return (abs($abC) <= $epsilon && $this->onSegment($a, $b, $c, $epsilon))
            || (abs($abD) <= $epsilon && $this->onSegment($a, $b, $d, $epsilon))
            || (abs($cdA) <= $epsilon && $this->onSegment($c, $d, $a, $epsilon))
            || (abs($cdB) <= $epsilon && $this->onSegment($c, $d, $b, $epsilon));
    }

    /**
     * @param  array{0: float, 1: float}  $a
     * @param  array{0: float, 1: float}  $b
     * @param  array{0: float, 1: float}  $point
     */
    private function orientation(array $a, array $b, array $point): float
    {
        return ($b[0] - $a[0]) * ($point[1] - $a[1])
            - ($b[1] - $a[1]) * ($point[0] - $a[0]);
    }

    /**
     * @param  array{0: float, 1: float}  $a
     * @param  array{0: float, 1: float}  $b
     * @param  array{0: float, 1: float}  $point
     */
    private function onSegment(array $a, array $b, array $point, float $epsilon): bool
    {
        return $point[0] >= min($a[0], $b[0]) - $epsilon
            && $point[0] <= max($a[0], $b[0]) + $epsilon
            && $point[1] >= min($a[1], $b[1]) - $epsilon
            && $point[1] <= max($a[1], $b[1]) + $epsilon;
    }

    /**
     * @return array{polygon: null, hectares: null, error: string}
     */
    private function invalid(string $message): array
    {
        return [
            'polygon' => null,
            'hectares' => null,
            'error' => $message,
        ];
    }
}
