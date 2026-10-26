<?php

use App\Services\FarmBoundaryOverlap;

/**
 * @param  list<array{0: float, 1: float}>  $points
 * @return list<array{0: float, 1: float}>
 */
function closedRing(array $points): array
{
    $points[] = $points[0];

    return $points;
}

test('half of a square overlapping another square is 50 percent', function () {
    $overlap = new FarmBoundaryOverlap;

    $percent = $overlap->percent(
        closedRing([[0, 0], [2, 0], [2, 2], [0, 2]]),
        closedRing([[1, 0], [3, 0], [3, 2], [1, 2]]),
    );

    expect($percent)->toBe(50.0);
});

test('a square inside a larger square reports the inner share', function () {
    $overlap = new FarmBoundaryOverlap;

    $percent = $overlap->percent(
        closedRing([[0, 0], [4, 0], [4, 4], [0, 4]]),
        closedRing([[1, 1], [3, 1], [3, 3], [1, 3]]),
    );

    expect($percent)->toBe(25.0);
});

test('identical squares overlap completely', function () {
    $ring = closedRing([[125.1, 8.1], [125.102, 8.1], [125.102, 8.102], [125.1, 8.102]]);

    expect((new FarmBoundaryOverlap)->percent($ring, $ring))->toBe(100.0);
});

test('squares that only share an edge do not overlap', function () {
    $overlap = new FarmBoundaryOverlap;

    $percent = $overlap->percent(
        closedRing([[0, 0], [2, 0], [2, 2], [0, 2]]),
        closedRing([[2, 0], [4, 0], [4, 2], [2, 2]]),
    );

    expect($percent)->toBe(0.0);
    expect($overlap->nearby(
        closedRing([[0, 0], [2, 0], [2, 2], [0, 2]]),
        closedRing([[2, 0], [4, 0], [4, 2], [2, 2]]),
    ))->toBeTrue();
});

test('separate squares are not nearby', function () {
    $overlap = new FarmBoundaryOverlap;

    expect($overlap->nearby(
        closedRing([[125.1, 8.1], [125.102, 8.1], [125.102, 8.102], [125.1, 8.102]]),
        closedRing([[126.2, 8.1], [126.202, 8.1], [126.202, 8.102], [126.2, 8.102]]),
    ))->toBeFalse();
});

test('concave field shapes still report the shared share', function () {
    $overlap = new FarmBoundaryOverlap;

    $percent = $overlap->percent(
        closedRing([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]]),
        closedRing([[1, 0], [3, 0], [3, 1], [2, 1], [2, 2], [1, 2]]),
    );

    expect($percent)->toBeGreaterThan(30.0)->toBeLessThan(37.0);
});
