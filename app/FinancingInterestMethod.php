<?php

namespace App;

enum FinancingInterestMethod: string
{
    case None = 'none';
    case Stated = 'stated';

    public function label(): string
    {
        return match ($this) {
            self::None => 'No interest',
            self::Stated => 'Stated amount',
        };
    }
}
