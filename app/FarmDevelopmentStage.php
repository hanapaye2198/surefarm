<?php

namespace App;

enum FarmDevelopmentStage: string
{
    case LandPreparation = 'land_preparation';
    case Planting = 'planting';
    case Harvest = 'harvest';
    case PostHarvest = 'post_harvest';

    public function label(): string
    {
        return match ($this) {
            self::LandPreparation => 'Land preparation',
            self::Planting => 'Planting',
            self::Harvest => 'Harvest',
            self::PostHarvest => 'Post harvest',
        };
    }
}
