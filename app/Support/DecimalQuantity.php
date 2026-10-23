<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Two-decimal quantities stored as integer cents.
 * Comparisons never use a PHP float as the source of truth.
 */
final class DecimalQuantity
{
    public static function cents(mixed $value): int
    {
        if (is_int($value)) {
            return $value * 100;
        }

        if (is_float($value)) {
            $value = number_format(round($value, 2), 2, '.', '');
        }

        if (! is_string($value) || preg_match('/^-?\d+(\.\d{1,2})?$/', $value) !== 1) {
            throw new InvalidArgumentException('Quantity must be a number with at most 2 decimal places.');
        }

        $negative = str_starts_with($value, '-');
        $absolute = ltrim($value, '-');
        [$whole, $fraction] = array_pad(explode('.', $absolute, 2), 2, '0');
        $fraction = str_pad(substr($fraction, 0, 2), 2, '0');

        $cents = ((int) $whole * 100) + (int) $fraction;

        return $negative ? -$cents : $cents;
    }

    public static function fromCents(int $cents): string
    {
        $negative = $cents < 0;
        $absolute = abs($cents);
        $formatted = intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);

        return $negative ? '-'.$formatted : $formatted;
    }
}
