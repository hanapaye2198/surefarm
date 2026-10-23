<?php

namespace App\Actions;

use App\AccessEventAction;
use App\CropType;
use App\HarvestStatus;
use App\InventoryMovementType;
use App\InventoryStatus;
use App\Models\FarmHarvest;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\InventoryProcessingStage;
use App\Models\User;
use App\Services\InventoryStock;
use App\Support\DecimalQuantity;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class ReceiveHarvestIntoInventory
{
    public function __construct(
        private InventoryStock $stock,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * Receive part of a completed coffee harvest into inventory.
     * The harvest quantity is left unchanged. The receipt unit must
     * be the harvest unit because kg, tons, and bags are not converted.
     *
     * @param  array{quantity: numeric-string|float|int, unit: string, processing_stage_id: int, location?: string|null, received_date: string, notes?: string|null, receipt_token?: string|null}  $data
     */
    public function handle(FarmHarvest $harvest, array $data, ?int $userId): Inventory
    {
        try {
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

                try {
                    $quantityCents = DecimalQuantity::cents($data['quantity']);
                } catch (InvalidArgumentException) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity must be a number with at most 2 decimal places.',
                    ]);
                }

                if ($quantityCents <= 0) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity must be greater than zero.',
                    ]);
                }

                if ($data['unit'] !== $harvest->unit) {
                    throw ValidationException::withMessages([
                        'unit' => 'Receipts use the harvest unit. kg, tons, and bags are not converted.',
                    ]);
                }

                $token = $this->token($data);

                if ($token !== null) {
                    $existing = $this->existingReceipt($token, $harvest, $quantityCents);

                    if ($existing instanceof Inventory) {
                        return $existing;
                    }
                }

                $remaining = DecimalQuantity::cents($harvest->quantity) - $this->stock->receivedCents($harvest);

                if ($quantityCents > $remaining) {
                    throw ValidationException::withMessages([
                        'quantity' => 'Quantity cannot exceed the harvest quantity that has not yet been received.',
                    ]);
                }

                $quantity = DecimalQuantity::fromCents($quantityCents);

                $inventory = Inventory::query()->create([
                    'farmer_id' => $harvest->farm->farmer_id,
                    'farm_id' => $harvest->farm_id,
                    'harvest_id' => $harvest->id,
                    'processing_stage_id' => $stage->id,
                    'crop_type' => $crop,
                    'quantity' => $quantity,
                    'unit' => $harvest->unit,
                    'status' => InventoryStatus::Available,
                    'location' => $data['location'] ?? null,
                    'received_date' => $data['received_date'],
                    'notes' => $data['notes'] ?? null,
                ]);

                InventoryMovement::query()->create([
                    'inventory_id' => $inventory->id,
                    'destination_stage_id' => $stage->id,
                    'quantity' => $quantity,
                    'unit' => $harvest->unit,
                    'movement_type' => InventoryMovementType::Receipt,
                    'movement_date' => $data['received_date'],
                    'reference_type' => 'harvest',
                    'reference_id' => $harvest->id,
                    'client_token' => $token,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $userId,
                ]);

                $this->record($userId, $inventory, $harvest, $quantity);

                return $inventory;
            });
        } catch (UniqueConstraintViolationException) {
            $token = $this->token($data);
            $existing = $token === null
                ? null
                : InventoryMovement::query()->where('client_token', $token)->first();

            if ($existing?->inventory instanceof Inventory) {
                return $existing->inventory;
            }

            throw ValidationException::withMessages([
                'receipt_token' => 'This receipt was already submitted.',
            ]);
        }
    }

    /**
     * @param  array{receipt_token?: string|null}  $data
     */
    private function token(array $data): ?string
    {
        $token = $data['receipt_token'] ?? null;

        return is_string($token) && $token !== '' ? $token : null;
    }

    private function existingReceipt(string $token, FarmHarvest $harvest, int $quantityCents): ?Inventory
    {
        $existing = InventoryMovement::query()->where('client_token', $token)->lockForUpdate()->first();

        if ($existing === null) {
            return null;
        }

        $sameReceipt = (int) $existing->reference_id === $harvest->id
            && $existing->unit === $harvest->unit
            && DecimalQuantity::cents($existing->quantity) === $quantityCents
            && $existing->inventory instanceof Inventory;

        if (! $sameReceipt) {
            throw ValidationException::withMessages([
                'receipt_token' => 'This receipt was already submitted with different details.',
            ]);
        }

        return $existing->inventory;
    }

    private function record(?int $userId, Inventory $inventory, FarmHarvest $harvest, string $quantity): void
    {
        $actor = $userId === null ? null : User::query()->find($userId);

        if (! $actor instanceof User) {
            return;
        }

        $this->accessEvents->handle($actor, AccessEventAction::InventoryReceived, null, $inventory, [
            'harvest_id' => $harvest->id,
            'quantity' => $quantity,
            'unit' => $harvest->unit,
        ]);
    }
}
