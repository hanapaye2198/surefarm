<?php

use App\Services\SphericalPolygonArea;

test('a closed polygon area is calculated in hectares', function () {
    $hectares = (new SphericalPolygonArea)->hectares([
        [125.1278, 8.1575],
        [125.1288, 8.1575],
        [125.1288, 8.1585],
        [125.1278, 8.1585],
        [125.1278, 8.1575],
    ]);

    // 0.001 degree square near latitude 8 is about 1.22 hectares.
    expect($hectares)->toBe(1.23);
});

test('a collapsed ring has no measurable area', function () {
    $hectares = (new SphericalPolygonArea)->hectares([
        [125.0, 8.0],
        [125.0, 8.0],
        [125.0, 8.0],
        [125.0, 8.0],
    ]);

    expect($hectares)->toBe(0.0);
});
