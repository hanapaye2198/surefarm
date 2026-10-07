<?php

namespace App\Services;

use App\Contracts\VerificationReferenceGenerator;
use InvalidArgumentException;

/**
 * DEMO verification reference allocator.
 *
 * Formats the database sequence as VER-000001. It is generated on the
 * server and is not an official verification numbering scheme.
 */
class DemoVerificationReferenceGenerator implements VerificationReferenceGenerator
{
    public function fromSequence(int $sequence): string
    {
        if ($sequence < 1) {
            throw new InvalidArgumentException('Verification reference sequence is out of range.');
        }

        return 'VER-'.str_pad((string) $sequence, 6, '0', STR_PAD_LEFT);
    }
}
