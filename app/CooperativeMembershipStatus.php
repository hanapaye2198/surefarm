<?php

namespace App;

enum CooperativeMembershipStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Ended = 'ended';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Suspended => 'Suspended',
            self::Ended => 'Ended',
        };
    }
}
