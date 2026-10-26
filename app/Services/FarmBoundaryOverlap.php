<?php

namespace App\Services;

/**
 * Share of one farm polygon that also lies inside another.
 * The result is a percentage of the first ring, not a surveyed area.
 */
final class FarmBoundaryOverlap
{
    /**
     * @param  list<array{0: float|int|string, 1: float|int|string}>  $subjectRing  Closed or open [longitude, latitude] ring.
     * @param  list<array{0: float|int|string, 1: float|int|string}>  $otherRing
     */
    public function percent(array $subjectRing, array $otherRing): float
    {
        $subject = $this->counterClockwise($this->open($subjectRing));
        $other = $this->counterClockwise($this->open($otherRing));

        if (count($subject) < 3 || count($other) < 3 || ! $this->boxesMeet($subject, $other, 0.0)) {
            return 0.0;
        }

        $whole = abs($this->signedArea($subject));

        if ($whole <= 0.0) {
            return 0.0;
        }

        $intersection = $this->intersection($subject, $other);
        $part = $intersection === null
            ? $this->sampledArea($subject, $other, $whole)
            : abs($this->signedArea($intersection));

        if ($part <= 0.0) {
            return 0.0;
        }

        return min(100.0, round(($part / $whole) * 100, 2));
    }

    /**
     * @param  list<array{0: float|int|string, 1: float|int|string}>  $subjectRing
     * @param  list<array{0: float|int|string, 1: float|int|string}>  $otherRing
     */
    public function nearby(array $subjectRing, array $otherRing): bool
    {
        $subject = $this->open($subjectRing);
        $other = $this->open($otherRing);

        if (count($subject) < 3 || count($other) < 3) {
            return false;
        }

        return $this->boxesMeet($subject, $other, 0.004);
    }

    /**
     * @param  list<array{0: float, 1: float}>  $subject
     * @param  list<array{0: float, 1: float}>  $other
     * @return list<array{0: float, 1: float}>|null Null asks the caller to sample a concave pair.
     */
    private function intersection(array $subject, array $other): ?array
    {
        if ($this->isConvex($other)) {
            return $this->clip($subject, $other);
        }

        if ($this->isConvex($subject)) {
            return $this->clip($other, $subject);
        }

        return null;
    }

    /**
     * @param  list<array{0: float|int|string, 1: float|int|string}>  $ring
     * @return list<array{0: float, 1: float}>
     */
    private function open(array $ring): array
    {
        $points = [];

        foreach ($ring as $position) {
            $points[] = [(float) $position[0], (float) $position[1]];
        }

        if (count($points) > 1) {
            $first = $points[0];
            $last = $points[array_key_last($points)];

            if ($first[0] === $last[0] && $first[1] === $last[1]) {
                array_pop($points);
            }
        }

        return $points;
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     * @return list<array{0: float, 1: float}>
     */
    private function counterClockwise(array $ring): array
    {
        if ($this->signedArea($ring) < 0) {
            return array_reverse($ring);
        }

        return $ring;
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     */
    private function signedArea(array $ring): float
    {
        $area = 0.0;
        $count = count($ring);

        for ($index = 0; $index < $count; $index++) {
            $next = $ring[($index + 1) % $count];
            $area += ($ring[$index][0] * $next[1]) - ($next[0] * $ring[$index][1]);
        }

        return $area / 2;
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     */
    private function isConvex(array $ring): bool
    {
        $count = count($ring);
        $sign = 0;

        if ($count < 3) {
            return false;
        }

        for ($index = 0; $index < $count; $index++) {
            $start = $ring[$index];
            $middle = $ring[($index + 1) % $count];
            $end = $ring[($index + 2) % $count];
            $cross = (($middle[0] - $start[0]) * ($end[1] - $middle[1]))
                - (($middle[1] - $start[1]) * ($end[0] - $middle[0]));

            if (abs($cross) <= 1.0e-14) {
                continue;
            }

            $current = $cross > 0 ? 1 : -1;

            if ($sign === 0) {
                $sign = $current;
            } elseif ($sign !== $current) {
                return false;
            }
        }

        return $sign !== 0;
    }

    /**
     * @param  list<array{0: float, 1: float}>  $subject
     * @param  list<array{0: float, 1: float}>  $clip  Convex ring.
     * @return list<array{0: float, 1: float}>
     */
    private function clip(array $subject, array $clip): array
    {
        $output = $subject;
        $edges = count($clip);

        for ($edge = 0; $edge < $edges; $edge++) {
            $input = $output;
            $output = [];
            $count = count($input);

            if ($count === 0) {
                break;
            }

            $edgeStart = $clip[$edge];
            $edgeEnd = $clip[($edge + 1) % $edges];
            $previous = $input[$count - 1];

            foreach ($input as $current) {
                $currentInside = $this->inside($edgeStart, $edgeEnd, $current);
                $previousInside = $this->inside($edgeStart, $edgeEnd, $previous);

                if ($currentInside) {
                    if (! $previousInside) {
                        $output[] = $this->crossing($previous, $current, $edgeStart, $edgeEnd);
                    }

                    $output[] = $current;
                } elseif ($previousInside) {
                    $output[] = $this->crossing($previous, $current, $edgeStart, $edgeEnd);
                }

                $previous = $current;
            }
        }

        return $output;
    }

    /**
     * @param  array{0: float, 1: float}  $start
     * @param  array{0: float, 1: float}  $end
     * @param  array{0: float, 1: float}  $point
     */
    private function inside(array $start, array $end, array $point): bool
    {
        $cross = (($end[0] - $start[0]) * ($point[1] - $start[1]))
            - (($end[1] - $start[1]) * ($point[0] - $start[0]));

        return $cross >= -1.0e-12;
    }

    /**
     * @param  array{0: float, 1: float}  $start
     * @param  array{0: float, 1: float}  $end
     * @param  array{0: float, 1: float}  $edgeStart
     * @param  array{0: float, 1: float}  $edgeEnd
     * @return array{0: float, 1: float}
     */
    private function crossing(array $start, array $end, array $edgeStart, array $edgeEnd): array
    {
        $denominator = (($start[0] - $end[0]) * ($edgeStart[1] - $edgeEnd[1]))
            - (($start[1] - $end[1]) * ($edgeStart[0] - $edgeEnd[0]));

        if (abs($denominator) < 1.0e-18) {
            return $end;
        }

        $distance = ((($start[0] - $edgeStart[0]) * ($edgeStart[1] - $edgeEnd[1]))
            - (($start[1] - $edgeStart[1]) * ($edgeStart[0] - $edgeEnd[0]))) / $denominator;

        return [
            $start[0] + ($distance * ($end[0] - $start[0])),
            $start[1] + ($distance * ($end[1] - $start[1])),
        ];
    }

    /**
     * @param  list<array{0: float, 1: float}>  $subject
     * @param  list<array{0: float, 1: float}>  $other
     */
    private function boxesMeet(array $subject, array $other, float $padding): bool
    {
        $subjectBox = $this->box($subject);
        $otherBox = $this->box($other);

        return $otherBox['max_x'] >= $subjectBox['min_x'] - $padding
            && $otherBox['min_x'] <= $subjectBox['max_x'] + $padding
            && $otherBox['max_y'] >= $subjectBox['min_y'] - $padding
            && $otherBox['min_y'] <= $subjectBox['max_y'] + $padding;
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     * @return array{min_x: float, max_x: float, min_y: float, max_y: float}
     */
    private function box(array $ring): array
    {
        $xs = array_column($ring, 0);
        $ys = array_column($ring, 1);

        return [
            'min_x' => min($xs),
            'max_x' => max($xs),
            'min_y' => min($ys),
            'max_y' => max($ys),
        ];
    }

    /**
     * @param  list<array{0: float, 1: float}>  $subject
     * @param  list<array{0: float, 1: float}>  $other
     */
    private function sampledArea(array $subject, array $other, float $whole): float
    {
        $box = $this->box($subject);
        $steps = 80;
        $insideSubject = 0;
        $insideBoth = 0;
        $width = ($box['max_x'] - $box['min_x']) / $steps;
        $height = ($box['max_y'] - $box['min_y']) / $steps;

        if ($width <= 0.0 || $height <= 0.0) {
            return 0.0;
        }

        for ($x = 0; $x < $steps; $x++) {
            for ($y = 0; $y < $steps; $y++) {
                $pointX = $box['min_x'] + (($x + 0.5) * $width);
                $pointY = $box['min_y'] + (($y + 0.5) * $height);

                if (! $this->contains($subject, $pointX, $pointY)) {
                    continue;
                }

                $insideSubject++;

                if ($this->contains($other, $pointX, $pointY)) {
                    $insideBoth++;
                }
            }
        }

        if ($insideSubject === 0) {
            return 0.0;
        }

        return $whole * ($insideBoth / $insideSubject);
    }

    /**
     * @param  list<array{0: float, 1: float}>  $ring
     */
    private function contains(array $ring, float $x, float $y): bool
    {
        $inside = false;
        $count = count($ring);

        for ($index = 0, $previous = $count - 1; $index < $count; $previous = $index++) {
            $currentY = $ring[$index][1];
            $previousY = $ring[$previous][1];
            $currentX = $ring[$index][0];
            $previousX = $ring[$previous][0];
            $crosses = ($currentY > $y) !== ($previousY > $y)
                && ($x < (($previousX - $currentX) * ($y - $currentY) / (($previousY - $currentY) ?: 1.0e-18)) + $currentX);

            if ($crosses) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }
}
