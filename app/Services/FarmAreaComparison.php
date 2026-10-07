<?php

namespace App\Services;

/**
 * Compares a farmer's declared area with the area measured from the
 * saved web-map boundary. Declared area is never overwritten.
 */
final class FarmAreaComparison
{
    /**
     * @return array{declared: float, measured: float, difference: float, variance: float}|null
     */
    public function calculate(float|string $declared, float|string|null $measured): ?array
    {
        if ($measured === null || $measured === '') {
            return null;
        }

        $declaredHectares = round((float) $declared, 2);
        $measuredHectares = round((float) $measured, 2);

        if ($declaredHectares <= 0) {
            return null;
        }

        $difference = round(abs($declaredHectares - $measuredHectares), 2);

        return [
            'declared' => $declaredHectares,
            'measured' => $measuredHectares,
            'difference' => $difference,
            'variance' => round(($difference / $declaredHectares) * 100, 2),
        ];
    }

    public function hectares(float $hectares): string
    {
        return number_format($hectares, 2, '.', '').' ha';
    }

    public function percent(float $percent): string
    {
        return number_format($percent, 2, '.', '').'%';
    }
}
