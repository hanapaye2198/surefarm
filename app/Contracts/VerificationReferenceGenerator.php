<?php

namespace App\Contracts;

/**
 * Allocates a unique verification reference such as VER-000001.
 *
 * This is a demo sequence format. Bind a replacement implementation if
 * SureFarm later defines an official verification reference scheme.
 */
interface VerificationReferenceGenerator
{
    public function fromSequence(int $sequence): string;
}
