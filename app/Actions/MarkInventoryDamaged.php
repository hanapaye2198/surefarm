<?php

namespace App\Actions;

use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarkInventoryDamaged
{
    /**
     * Split damaged coffee out of available stock and keep both balances.
     *
     * @param  array{quantity: numeric-string|float|int, reason: string, movement_date: string}  $data
     */
    public function handle(Inventory $inventory, array $data, ?int $userId): Inventory
    {
        return DB::transaction(function () use ($inventory, $data, $userId): Inventory {
            $source = Inventory::query()->lockForUpdate()->findOrFail($inventory->id);

            if ($source->status !== InventoryStatus::Available) {
                throw ValidationException::withMessages([
                    'quantity' => 'Only available inventory can be marked as damaged.',
                ]);
            }

            $amount = round((float) $data['quantity'], 2);

            if ($amount > (float) $source->quantity) {
                throw ValidationException::withMessages([
                    'quantity' => 'Damaged quantity cannot exceed the available inventory.',
                ]);
            }

            $source->quantity = number_format(round((float) $source->quantity - $amount, 2), 2, '.', '');
            $source->save();

            $damaged = Inventory::query()
                ->where('farmer_id', $source->farmer_id)
                ->where('farm_id', $source->farm_id)
                ->where('harvest_id', $source->harvest_id)
                ->where('crop_type', $source->crop_type)
                ->where('processing_stage_id', $source->processing_stage_id)
                ->where('unit', $source->unit)
                ->where('status', InventoryStatus::Damaged)
                ->when(
                    $source->location === null,
                    fn ($query) => $query->whereNull('location'),
                    fn ($query) => $query->where('location', $source->location),
                )
                ->lockForUpdate()
                ->first();

            if ($damaged === null) {
                $damaged = Inventory::query()->create([
                    'farmer_id' => $source->farmer_id,
                    'farm_id' => $source->farm_id,
                    'harvest_id' => $source->harvest_id,
                    'processing_stage_id' => $source->processing_stage_id,
                    'crop_type' => $source->crop_type,
                    'quantity' => $amount,
                    'unit' => $source->unit,
                    'status' => InventoryStatus::Damaged,
                    'location' => $source->location,
                    'received_date' => $data['movement_date'],
                    'notes' => $data['reason'],
                ]);
            } else {
                $damaged->quantity = number_format(round((float) $damaged->quantity + $amount, 2), 2, '.', '');
                $damaged->save();
            }

            InventoryMovement::query()->create([
                'inventory_id' => $source->id,
                'destination_inventory_id' => $damaged->id,
                'source_stage_id' => $source->processing_stage_id,
                'quantity' => $amount,
                'unit' => $source->unit,
                'movement_type' => InventoryMovementType::Damage,
                'movement_date' => $data['movement_date'],
                'notes' => $data['reason'],
                'created_by' => $userId,
            ]);

            return $damaged;
        });
    }
}
