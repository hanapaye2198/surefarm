<?php

namespace App;

enum FinancingDirection: string
{
    case Increase = 'increase';
    case Decrease = 'decrease';

    public function opposite(): self
    {
        return $this === self::Increase ? self::Decrease : self::Increase;
    }

    public function label(): string
    {
        return match ($this) {
            self::Increase => 'Increases amount due',
            self::Decrease => 'Reduces amount due',
        };
    }
}
