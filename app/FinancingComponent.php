<?php

namespace App;

enum FinancingComponent: string
{
    case Principal = 'principal';
    case Interest = 'interest';
    case Fee = 'fee';

    public function label(): string
    {
        return match ($this) {
            self::Principal => 'Principal',
            self::Interest => 'Interest',
            self::Fee => 'Fee',
        };
    }
}
