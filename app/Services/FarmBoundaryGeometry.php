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
