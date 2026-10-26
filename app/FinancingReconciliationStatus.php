<?php

namespace App;

enum FinancingReconciliationStatus: string
{
    case Recorded = 'recorded';
    case Reconciled = 'reconciled';

    public function label(): string
    {
        return match ($this) {
            self::Recorded => 'Recorded',
            self::Reconciled => 'Reconciled',
        };
    }
}
