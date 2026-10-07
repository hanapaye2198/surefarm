<?php

namespace App;

enum ProductionStatus: string
{
    case Planned = 'planned';
    case Active = 'active';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Planned => 'Planned',
            self::Active => 'Active',
            self::Completed => 'Completed',
        };
    }
}
