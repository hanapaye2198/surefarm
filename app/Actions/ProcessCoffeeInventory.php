<?php

namespace App\Actions;

use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Services\InventoryStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProcessCoffeeInventory
{
    public function __construct(private InventoryStock $stock) {}

    /**
     * Move coffee to the next stage. Input and output quantities
     * are both recorded because processing yield is not one to one.
     *
     * @param  array{inventory_id: int, input_quantity: numeric-string|float|int, output_quantity: numeric-string|float|int, destination_stage_id: int, processing_date: string, location?: string|null, notes?: string|null}  $data
     */
    public function handle(array $data, ?int $userId): Inventory
    {
        return DB::transaction(function () use ($data, $userId): Inventory {
            $source = Inventory::query()->lockForUpdate()->find($data['inventory_id']);

            if ($source === null || $source->status !== InventoryStatus::Available) {
                throw ValidationException::withMessages([
                    'inventory_id' => 'Choose available coffee inventory to process.',
                ]);
            }

            $source->load('stage');
            $next = $source->stage === null ? null : $this->stock->nextStage($source->stage);

            if ($next === null) {
                throw ValidationException::withMessages([
                    'destination_stage_id' => 'This coffee is already at the last processing stage.',
                ]);
            }

            if ((int) $data['destination_stage_id'] !== $next->id) {
                throw ValidationException::withMessages([
                    'destination_stage_id' => 'The destination stage must be the next processing stage.',
                ]);
            }

            $input = round((float) $data['input_quantity'], 2);
            $output = round((float) $data['output_quantity'], 2);

            if ($input > (float) $source->quantity) {
                throw ValidationException::withMessages([
                    'input_quantity' => 'Input quantity cannot exceed the available inventory.',
                ]);
            }

            $source->quantity = $this->subtract($source->quantity, $input);
            $source->save();

            $location = array_key_exists('location', $data) && $data['location'] !== null && $data['location'] !== ''
                ? $data['location']
                : $source->location;

            $destination = $this->balanceFor($source, $next, $location);

            if ($destination === null) {
                $destination = Inventory::query()->create([
                    'farmer_id' => $source->farmer_id,
                    'farm_id' => $source->farm_id,
                    'harvest_id' => $source->harvest_id,
                    'processing_stage_id' => $next->id,
                    'crop_type' => $source->crop_type,
                    'quantity' => $output,
                    'unit' => $source->unit,
                    'status' => InventoryStatus::Available,
                    'location' => $location,
                    'received_date' => $data['processing_date'],
                    'notes' => null,
                ]);
            } else {
                $destination->quantity = $this->add($destination->quantity, $output);
                $destination->save();
            }

            InventoryMovement::query()->create([
                'inventory_id' => $source->id,
                'destination_inventory_id' => $destination->id,
                'source_stage_id' => $source->processing_stage_id,
                'destination_stage_id' => $next->id,
                'quantity' => $input,
                'output_quantity' => $output,
                'unit' => $source->unit,
                'movement_type' => InventoryMovementType::Processing,
                'movement_date' => $data['processing_date'],
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            return $destination;
        });
    }

    private function balanceFor(Inventory $source, InventoryProcessingStage $stage, ?string $location): ?Inventory
    {
        return Inventory::query()
            ->where('farmer_id', $source->farmer_id)
            ->where('farm_id', $source->farm_id)
            ->where('harvest_id', $source->harvest_id)
            ->where('crop_type', $source->crop_type)
            ->where('processing_stage_id', $stage->id)
            ->where('unit', $source->unit)
            ->where('status', InventoryStatus::Available)
            ->when(
                $location === null,
                fn ($query) => $query->whereNull('location'),
                fn ($query) => $query->where('location', $location),
            )
            ->lockForUpdate()
            ->first();
    }

    private function subtract(float|string $current, float $amount): string
    {
        return number_format(round((float) $current - $amount, 2), 2, '.', '');
    }

    private function add(float|string $current, float $amount): string
    {
        return number_format(round((float) $current + $amount, 2), 2, '.', '');
    }
}
