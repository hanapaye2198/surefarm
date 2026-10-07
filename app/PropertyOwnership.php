<?php

namespace App;

enum PropertyOwnership: string
{
    case Owned = 'owned';
    case Leased = 'leased';
    case IpLand = 'ip_land';
    case Reserve = 'reserve';

    public function label(): string
    {
        return match ($this) {
            self::Owned => 'Owned',
            self::Leased => 'Leased',
            self::IpLand => 'IP Land',
            self::Reserve => 'Reserve',
        };
    }
}
