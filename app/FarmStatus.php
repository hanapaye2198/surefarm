<?php

namespace App;

enum FarmStatus: string
{
    case Active = 'active';
    case Inactive = 'inactive';
    case Harvesting = 'harvesting';
    case UnderDevelopment = 'under_development';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Inactive => 'Inactive',
            self::Harvesting => 'Harvesting',
            self::UnderDevelopment => 'Under development',
        };
    }
}
