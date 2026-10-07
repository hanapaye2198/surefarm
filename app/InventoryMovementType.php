<?php

namespace App;

enum InventoryMovementType: string
{
    case Receipt = 'receipt';
    case Processing = 'processing';
    case Adjustment = 'adjustment';
    case Release = 'release';
    case Damage = 'damage';

    public function label(): string
    {
        return match ($this) {
            self::Receipt => 'Receipt',
            self::Processing => 'Processing',
            self::Adjustment => 'Adjustment',
            self::Release => 'Release',
            self::Damage => 'Damage',
        };
    }
}
