<?php

namespace App\Services;

use App\Contracts\FarmIdGenerator;
use InvalidArgumentException;

/**
 * DEMO farm ID allocator.
 *
 * Formats the database sequence as FARM-000001. It is not an official
 * farm identification scheme and can be replaced by binding a different
 * FarmIdGenerator implementation.
 */
class DemoFarmIdGenerator implements FarmIdGenerator
{
    public function fromSequence(int $sequence): string
    {
        if ($sequence < 1) {
            throw new InvalidArgumentException('Farm ID sequence is out of range.');
        }

        return 'FARM-'.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);
    }
}
