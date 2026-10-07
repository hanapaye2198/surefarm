<?php

namespace App;

enum InventoryStatus: string
{
    case Available = 'available';
    case Reserved = 'reserved';
    case Processing = 'processing';
    case Damaged = 'damaged';
    case Expired = 'expired';
    case Released = 'released';

    public function label(): string
    {
        return match ($this) {
            self::Available => 'Available',
            self::Reserved => 'Reserved',
            self::Processing => 'Processing',
            self::Damaged => 'Damaged',
            self::Expired => 'Expired',
            self::Released => 'Released',
        };
    }
}
