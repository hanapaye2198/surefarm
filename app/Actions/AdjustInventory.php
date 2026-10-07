<?php

namespace App\Actions;

use App\InventoryMovementType;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdjustInventory
{
    /**
     * Change an on-hand balance and keep an adjustment movement.
     *
     * @param  array{quantity: numeric-string|float|int, direction: string, reason: string, movement_date: string}  $data
     */
    public function handle(Inventory $inventory, array $data, ?int $userId): Inventory
    {
        return DB::transaction(function () use ($inventory, $data, $userId): Inventory {
            $inventory = Inventory::query()->lockForUpdate()->findOrFail($inventory->id);
            $amount = round((float) $data['quantity'], 2);
            $increase = $data['direction'] === 'increase';

            if (! $increase && $amount > (float) $inventory->quantity) {
                throw ValidationException::withMessages([
                    'quantity' => 'The decrease cannot exceed the current quantity.',
                ]);
            }

            $inventory->quantity = number_format(
                round((float) $inventory->quantity + ($increase ? $amount : -$amount), 2),
                2,
                '.',
                '',
            );
            $inventory->save();

            InventoryMovement::query()->create([
                'inventory_id' => $inventory->id,
                'source_stage_id' => $inventory->processing_stage_id,
                'quantity' => $amount,
                'unit' => $inventory->unit,
                'movement_type' => InventoryMovementType::Adjustment,
                'direction' => $data['direction'],
                'movement_date' => $data['movement_date'],
                'notes' => $data['reason'],
                'created_by' => $userId,
            ]);

            return $inventory;
        });
    }
}
