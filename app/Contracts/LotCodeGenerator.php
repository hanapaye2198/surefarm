<?php

namespace App\Contracts;

interface LotCodeGenerator
{
    /**
     * Next unique lot code. Call this inside the traceability transaction.
     */
    public function next(): string;
}
