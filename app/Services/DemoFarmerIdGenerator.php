<?php

namespace App\Services;

use App\Contracts\FarmerIdGenerator;
use InvalidArgumentException;

/**
 * Provisional farmer ID allocator.
 *
 * The official location-code and security-control rules are not defined.
 * Until they are, generated IDs are visibly provisional and do not imitate
 * the official four-code format. Replace this binding when the rules arrive.
 */
class DemoFarmerIdGenerator implements FarmerIdGenerator
{
    public function fromSequence(int $sequence): string
    {
        if ($sequence < 1) {
            throw new InvalidArgumentException('Farmer ID sequence is out of range.');
        }

        return 'SF-PROV-'.str_pad((string) $sequence, 7, '0', STR_PAD_LEFT);
    }
}
