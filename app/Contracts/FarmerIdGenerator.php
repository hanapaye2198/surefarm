<?php

namespace App\Contracts;

/**
 * Allocates a unique farmer identifier.
 *
 * The official location-code and security-control rules are not defined.
 * The current implementation therefore returns an explicitly provisional ID.
 * Bind the official implementation when those rules are approved.
 */
interface FarmerIdGenerator
{
    public function fromSequence(int $sequence): string;
}
