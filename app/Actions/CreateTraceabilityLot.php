<?php

namespace App\Actions;

use App\Contracts\LotCodeGenerator;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\TraceabilityLot;
use App\Services\TraceabilityJourney;
use App\TraceabilityLotStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateTraceabilityLot
{
    public function __construct(
        private LotCodeGenerator $lotCodes,
        private TraceabilityJourney $journey,
    ) {}

    /**
     * Move part of an eligible inventory balance into a traceability lot.
     * The lot keeps the inventory's farmer, farm, crop, and harvest.
     *
     * @param  array{inventory_id: int, quantity: numeric-string|float|int, unit: string, notes?: string|null}  $data
     */
    public function handle(array $data, ?int $userId): TraceabilityLot
    {
        return DB::transaction(function () use ($data, $userId): TraceabilityLot {
            $inventory = Inventory::query()->lockForUpdate()->find($data['inventory_id']);

            if ($inventory === null || $inventory->status !== InventoryStatus::Available) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'Choose available coffee inventory.',
                ]);
            }

            $inventory->load(['stage', 'farm', 'harvest']);
            $eligible = config('traceability.eligible_stage_codes', []);

            if ($inventory->stage === null || ! in_array($inventory->stage->code, $eligible, true)) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'Traceability lots start from green bean inventory.',
                ]);
            }

            if ($inventory->farm === null) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'This inventory is not linked to a farm.',
                ]);
            }

            if ($inventory->farmer_id !== null && (int) $inventory->farmer_id !== (int) $inventory->farm->farmer_id) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'The farmer, farm, and harvest do not belong together.',
                ]);
            }

            if ($inventory->harvest !== null && (int) $inventory->harvest->farm_id !== (int) $inventory->farm_id) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'The farmer, farm, and harvest do not belong together.',
                ]);
            }

            if ($data['unit'] !== $inventory->unit) {
                throw ValidationException::withMessages([
                    'unit' => 'Use the same unit as the source inventory.',
                ]);
            }

            $quantity = round((float) $data['quantity'], 2);

            if ($quantity > (float) $inventory->quantity) {
                throw ValidationException::withMessages([
                    'quantity' => 'Quantity cannot exceed the available inventory.',
                ]);
            }

            $lot = TraceabilityLot::query()->create([
                'lot_code' => $this->lotCodes->next(),
                'farmer_id' => $inventory->farmer_id ?? $inventory->farm->farmer_id,
                'farm_id' => $inventory->farm_id,
                'crop_type' => $inventory->crop_type ?? $inventory->harvest?->crop_type ?? $inventory->farm->crop_type,
                'harvest_id' => $inventory->harvest_id,
                'current_inventory_id' => $inventory->id,
                'quantity' => $quantity,
                'unit' => $inventory->unit,
                'status' => TraceabilityLotStatus::Active,
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            $inventory->quantity = number_format(round((float) $inventory->quantity - $quantity, 2), 2, '.', '');
            $inventory->save();

            InventoryMovement::query()->create([
                'inventory_id' => $inventory->id,
                'source_stage_id' => $inventory->processing_stage_id,
                'destination_stage_id' => $inventory->processing_stage_id,
                'quantity' => $quantity,
                'unit' => $inventory->unit,
                'movement_type' => InventoryMovementType::Release,
                'direction' => 'decrease',
                'movement_date' => now()->toDateString(),
                'reference_type' => 'traceability_lot',
                'reference_id' => $lot->id,
                'notes' => 'Allocated to traceability lot '.$lot->lot_code.'.',
                'created_by' => $userId,
            ]);

            $this->journey->record($lot, $userId);

            return $lot;
        });
    }
}
