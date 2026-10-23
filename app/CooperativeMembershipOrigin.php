<?php

namespace App;

enum CooperativeMembershipOrigin: string
{
    case Recorded = 'recorded';
    case Migration = 'migration';

    public function label(): string
    {
        return match ($this) {
            self::Recorded => 'Recorded',
            self::Migration => 'Opening record',
        };
    }
}
