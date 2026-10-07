<?php

namespace App;

enum ActivityCategory: string
{
    case FarmPreparation = 'farm_preparation';
    case CropCare = 'crop_care';
    case Protection = 'protection';
    case Inspection = 'inspection';
    case Harvest = 'harvest';
    case PostHarvest = 'post_harvest';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::FarmPreparation => 'Farm preparation',
            self::CropCare => 'Crop care',
            self::Protection => 'Protection',
            self::Inspection => 'Inspection',
            self::Harvest => 'Harvest',
            self::PostHarvest => 'Post harvest',
            self::Other => 'Other',
        };
    }
}
