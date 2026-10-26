<?php

namespace App;

enum FinancingRepaymentFrequency: string
{
    case LumpSum = 'lump_sum';
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';

    public function label(): string
    {
        return match ($this) {
            self::LumpSum => 'Lump sum',
            self::Monthly => 'Monthly',
            self::Quarterly => 'Quarterly',
        };
    }
}
