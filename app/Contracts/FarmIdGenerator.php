<?php

namespace App\Contracts;

/**
 * Allocates a unique farm ID such as FARM-000001.
 *
 * This is a demo sequence format. Bind a replacement implementation if
 * SureFarm later defines an official farm identification scheme.
 */
interface FarmIdGenerator
{
    public function fromSequence(int $sequence): string;
}
