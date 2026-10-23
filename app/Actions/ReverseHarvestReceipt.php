<?php

namespace App\Actions;

use App\AccessEventAction;
use App\InventoryMovementType;
use App\Models\Inventory;
use App\Models\InventoryMovement;
use App\Models\User;
use App\Support\DecimalQuantity;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReverseHarvestReceipt
{
    public function __construct(private RecordAccessEvent $accessEvents) {}

    /**
     * Reverse one receipt with a new movement. The original receipt stays.
     */
    public function handle(Inventory $inventory, InventoryMovement $movement, User $actor): Inventory
    {
        return DB::transaction(function () use ($inventory, $movement, $actor): Inventory {
            $movement = InventoryMovement::query()->whereKey($movement->id)->lockForUpdate()->firstOrFail();
            $inventory = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();

            $this->assertReversible($inventory, $movement);

            $receiptCents = DecimalQuantity::cents($movement->quantity);
            $onHand = DecimalQuantity::cents($inventory->quantity);

            if ($receiptCents > $onHand) {
                throw ValidationException::withMessages([
                    'movement' => 'The on-hand quantity is lower than this receipt.',
                ]);
            }

            $inventory->update([
                'quantity' => DecimalQuantity::fromCents($onHand - $receiptCents),
            ]);

            $reversal = InventoryMovement::query()->create([
                'inventory_id' => $inventory->id,
                'quantity' => DecimalQuantity::fromCents($receiptCents),
                'unit' => $movement->unit,
                'movement_type' => InventoryMovementType::Reversal,
                'movement_date' => now()->toDateString(),
                'reference_type' => 'harvest',
                'reference_id' => $movement->reference_id,
                'reverses_movement_id' => $movement->id,
                'notes' => 'Reversed receipt '.$movement->id.'.',
                'created_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InventoryReceiptReversed, null, $inventory, [
                'movement_id' => $movement->id,
                'reversal_id' => $reversal->id,
                'quantity' => DecimalQuantity::fromCents($receiptCents),
                'unit' => $movement->unit,
            ]);

            return $inventory;
        });
    }

    public function reversible(Inventory $inventory, InventoryMovement $movement): bool
    {
        if ($movement->inventory_id !== $inventory->id || $movement->movement_type !== InventoryMovementType::Receipt) {
            return false;
        }

        if ($movement->unit !== $inventory->unit) {
            return false;
        }

        if (InventoryMovement::query()->where('reverses_movement_id', $movement->id)->exists()) {
            return false;
        }

        return ! $this->hasLaterMovement($inventory, $movement);
    }

    private function assertReversible(Inventory $inventory, InventoryMovement $movement): void
    {
        if (! $this->reversible($inventory, $movement)) {
            throw ValidationException::withMessages([
                'movement' => 'This receipt cannot be reversed. Later stock movements have to stay in the ledger.',
            ]);
        }
    }

    private function hasLaterMovement(Inventory $inventory, InventoryMovement $movement): bool
    {
        return InventoryMovement::query()
            ->where(function ($query) use ($inventory): void {
                $query->where('inventory_id', $inventory->id)
                    ->orWhere('destination_inventory_id', $inventory->id);
            })
            ->whereKeyNot($movement->id)
            ->exists();
    }
}
