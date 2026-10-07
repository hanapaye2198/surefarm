<?php

namespace App\Actions;

use App\CropType;
use App\HarvestStatus;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Services\InventoryStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceiveHarvestIntoInventory
{
    public function __construct(private InventoryStock $stock) {}

    /**
     * Receive part of a completed coffee harvest into inventory.
     * The harvest quantity is left unchanged.
     *
     * @param  array{quantity: numeric-string|float|int, unit: string, processing_stage_id: int, location?: string|null, received_date: string, notes?: string|null}  $data
     */
    public function handle(FarmHarvest $harvest, array $data, ?int $userId): Inventory
    {
        return DB::transaction(function () use ($harvest, $data, $userId): Inventory {
            $harvest = FarmHarvest::query()->whereKey($harvest->id)->lockForUpdate()->firstOrFail();
            $harvest->load('farm');

            if ($harvest->status !== HarvestStatus::Completed) {
                throw ValidationException::withMessages([
                    'quantity' => 'Only a completed harvest can be received into inventory.',
                ]);
            }

            $crop = $harvest->crop_type ?? $harvest->farm->crop_type;

            if ($crop !== CropType::Coffee) {
                throw ValidationException::withMessages([
                    'quantity' => 'Only coffee harvests can be received into inventory.',
                ]);
            }

            $stage = InventoryProcessingStage::query()->find($data['processing_stage_id']);

            if ($stage === null) {
                throw ValidationException::withMessages([
                    'processing_stage_id' => 'Choose a processing stage.',
                ]);
            }

            $quantity = round((float) $data['quantity'], 2);

            if ($data['unit'] === $harvest->unit) {
                $remaining = $this->stock->remainingReceivable($harvest);

                if ($quantity > $remaining) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity cannot exceed the harvest quantity that has not yet been received.',
                    ]);
                }
            }

            $inventory = Inventory::query()->create([
                'farmer_id' => $harvest->farm->farmer_id,
                'farm_id' => $harvest->farm_id,
                'harvest_id' => $harvest->id,
                'processing_stage_id' => $stage->id,
                'crop_type' => $crop,
                'quantity' => $quantity,
                'unit' => $data['unit'],
                'status' => InventoryStatus::Available,
                'location' => $data['location'] ?? null,
                'received_date' => $data['received_date'],
                'notes' => $data['notes'] ?? null,
            ]);

            InventoryMovement::query()->create([
                'inventory_id' => $inventory->id,
                'destination_stage_id' => $stage->id,
                'quantity' => $quantity,
                'unit' => $data['unit'],
                'movement_type' => InventoryMovementType::Receipt,
                'movement_date' => $data['received_date'],
                'reference_type' => 'harvest',
                'reference_id' => $harvest->id,
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            return $inventory;
        });
    }
}
