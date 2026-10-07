<?php

namespace App;

enum FinancingType: string
{
    case Mm = 'mm';
    case Govt = 'govt';

    public function label(): string
    {
        return match ($this) {
            self::Mm => 'MM',
            self::Govt => 'Govt',
        };
    }
}
