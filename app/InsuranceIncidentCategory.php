<?php

namespace App;

enum InsuranceIncidentCategory: string
{
    case Drought = 'drought';
    case Flood = 'flood';
    case Pest = 'pest';
    case Disease = 'disease';
    case Wind = 'wind';
    case Fire = 'fire';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Drought => 'Drought',
            self::Flood => 'Flood',
            self::Pest => 'Pest',
            self::Disease => 'Disease',
            self::Wind => 'Wind',
            self::Fire => 'Fire',
            self::Other => 'Other',
        };
    }
}
