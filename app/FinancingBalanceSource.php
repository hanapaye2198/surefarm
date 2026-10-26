<?php

namespace App;

enum FinancingBalanceSource: string
{
    case Snapshot = 'snapshot';
    case Ledger = 'ledger';

    public function label(): string
    {
        return match ($this) {
            self::Snapshot => 'Stated balance',
            self::Ledger => 'Ledger',
        };
    }
}
