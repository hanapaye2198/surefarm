<?php

namespace App\Services;

use App\Contracts\FarmerIdGenerator;
use InvalidArgumentException;

/**
 * DEMO farmer ID allocator.
 *
 * SureFarm still needs the official security-control specification.
 * Until then, this class only formats a database sequence as
 * SF-XXX-XXX-XXX-XXX so every farmer receives a unique ID in the
 * required shape. It is not a security algorithm and must be replaced
 * by binding a different FarmerIdGenerator implementation.
 */
class DemoFarmerIdGenerator implements FarmerIdGenerator
{
    public function fromSequence(int $sequence): string
    {
        if ($sequence < 1 || $sequence > 999_999_999_999) {
            throw new InvalidArgumentException('Farmer ID sequence is out of range.');
        }

        $digits = str_pad((string) $sequence, 12, '0', STR_PAD_LEFT);

        return sprintf(
            'SF-%s-%s-%s-%s',
            substr($digits, 0, 3),
            substr($digits, 3, 3),
            substr($digits, 6, 3),
            substr($digits, 9, 3),
        );
    }
}
