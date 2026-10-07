<?php

namespace App;

enum TraceabilityEventType: string
{
    case Origin = 'origin';
    case Harvest = 'harvest';
    case InventoryReceipt = 'inventory_receipt';
    case Processing = 'processing';
    case TraceabilityCreated = 'traceability_created';
    case StatusChange = 'status_change';

    public function label(): string
    {
        return match ($this) {
            self::Origin => 'Farm origin',
            self::Harvest => 'Harvest',
            self::InventoryReceipt => 'Inventory receipt',
            self::Processing => 'Processing',
            self::TraceabilityCreated => 'Traceability created',
            self::StatusChange => 'Status change',
        };
    }
}
