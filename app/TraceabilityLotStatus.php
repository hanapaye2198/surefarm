<?php

namespace App;

enum TraceabilityLotStatus: string
{
    case Active = 'active';
    case Processing = 'processing';
    case Completed = 'completed';
    case Released = 'released';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Processing => 'Processing',
            self::Completed => 'Completed',
            self::Released => 'Released',
            self::Cancelled => 'Cancelled',
        };
    }
}
