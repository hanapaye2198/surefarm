<?php

namespace App\Contracts;

/**
 * Allocates a unique farmer ID in the SF-XXX-XXX-XXX-XXX format.
 *
 * The official security-control algorithm is not defined. Bind a replacement
 * implementation when that specification arrives. Do not treat the current
 * segments as sitio, barangay, LGU, or security codes.
 */
interface FarmerIdGenerator
{
    public function fromSequence(int $sequence): string;
}
